import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Sentry from "@sentry/cloudflare";
import { wrapRequestHandler } from "@sentry/cloudflare/request";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as HttpServerError from "effect/http/HttpServerError";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

// Effect's scheduler can run fibers of concurrent requests in the same tick, so Sentry's
// AsyncLocalStorage lookup of the current scope can't be trusted inside a fiber. The request's
// scopes are read once where it can (inside `wrapRequestHandler`) and passed down as a service.
export class SentryScope extends Context.Service<
  SentryScope,
  { readonly isolationScope: Sentry.Scope; readonly scope: Sentry.Scope }
>()("blikka/sentry/SentryScope") {}

// Tagged with the trace id, so the full request trace can be found in Axiom.
export const captureException = Effect.fn("Sentry.captureException")(function* (error: unknown) {
  const { isolationScope, scope } = yield* SentryScope;
  const span = yield* Effect.option(Effect.currentSpan);
  const tags = Option.match(span, {
    onNone: () => ({}),
    onSome: (span) => ({ trace_id: span.traceId }),
  });
  yield* Effect.sync(() =>
    Sentry.withIsolationScope(isolationScope, () =>
      Sentry.withScope(scope, () => Sentry.captureException(error, { tags })),
    ),
  );
});

// Failures that know their response (Unauthorized → 401) are expected and interrupts are
// aborted requests; any other failure or defect is a bug.
const isUnexpected = (cause: Cause.Cause<unknown>) =>
  cause.reasons.some((reason) =>
    Cause.isFailReason(reason)
      ? !HttpServerRespondable.isRespondable(reason.error)
      : Cause.isDieReason(reason),
  );

/**
 * Runs an HTTP handler inside a Sentry request scope (request data, flushing via `waitUntil`).
 * Unexpected failures and defects are logged and reported; every failure becomes a response:
 * its own when it is respondable, otherwise a 500.
 */
export const withSentry = (options: Sentry.CloudflareOptions) => {
  // What `Sentry.withSentry` sets up for a plain handler: without it each request shares one scope.
  Sentry.setAsyncLocalStorageAsyncContextStrategy();
  return <E, R>(self: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
    Effect.gen(function* () {
      const execution = yield* Cloudflare.WorkerExecutionContext;
      const request = yield* HttpServerRequest.toWeb(
        yield* HttpServerRequest.HttpServerRequest,
      ).pipe(Effect.mapError((reason) => new HttpServerError.HttpServerError({ reason })));
      const context = yield* Effect.context<Exclude<R, SentryScope>>();
      const response = yield* Effect.promise((signal) =>
        // captureErrors: false — reporting happens below, where expected errors can be told apart.
        wrapRequestHandler({ options, request, context: execution.raw, captureErrors: false }, () =>
          Effect.runPromiseWith(context)(
            self.pipe(
              Effect.tapCause((cause) =>
                isUnexpected(cause)
                  ? Effect.andThen(Effect.logError(cause), captureException(Cause.squash(cause)))
                  : Effect.void,
              ),
              Effect.catchCause((cause) =>
                Effect.map(HttpServerError.causeResponse(cause), ([response]) => response),
              ),
              Effect.map((response) => HttpServerResponse.toWeb(response, { context })),
              Effect.provideService(SentryScope, {
                isolationScope: Sentry.getIsolationScope(),
                scope: Sentry.getCurrentScope(),
              }),
            ),
            { signal },
          ),
        ),
      );
      return HttpServerResponse.fromWeb(response);
    });
};
