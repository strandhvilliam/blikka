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

export class SentryScope extends Context.Service<
  SentryScope,
  { readonly isolationScope: Sentry.Scope; readonly scope: Sentry.Scope }
>()("blikka/sentry/SentryScope") {}

export const captureException = Effect.fn("Sentry.captureException")(function* (cause: unknown) {
  const { isolationScope, scope } = yield* SentryScope;
  const span = yield* Effect.option(Effect.currentSpan);

  const tags = Option.match(span, {
    onNone: () => ({}),
    onSome: (span) => ({ trace_id: span.traceId }),
  });

  yield* Effect.sync(() =>
    Sentry.withIsolationScope(isolationScope, () =>
      Sentry.withScope(scope, () => Sentry.captureException(cause, { tags })),
    ),
  );
});

export const reportCause = (cause: Cause.Cause<unknown>) =>
  Effect.gen(function* () {
    yield* Effect.logError(cause);
    yield* captureException(Cause.squash(cause));
  });

const isUnexpected = (cause: Cause.Cause<unknown>) =>
  cause.reasons.some((reason) => {
    if (Cause.isFailReason(reason)) {
      return !HttpServerRespondable.isRespondable(reason.error);
    }

    return Cause.isDieReason(reason);
  });

export const withSentry = (options: Sentry.CloudflareOptions) => {
  Sentry.setAsyncLocalStorageAsyncContextStrategy();

  return <E, R>(self: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
    Effect.gen(function* () {
      const execution = yield* Cloudflare.WorkerExecutionContext;
      const serverRequest = yield* HttpServerRequest.HttpServerRequest;

      const request = yield* HttpServerRequest.toWeb(serverRequest).pipe(
        Effect.mapError((reason) => new HttpServerError.HttpServerError({ reason })),
      );

      const context = yield* Effect.context<Exclude<R, SentryScope>>();

      const handled = self.pipe(
        Effect.tapCause((cause) => (isUnexpected(cause) ? reportCause(cause) : Effect.void)),
        Effect.catchCause((cause) => Effect.map(HttpServerError.causeResponse(cause), ([response]) => response)),
        Effect.map((response) => HttpServerResponse.toWeb(response, { context })),
      );

      const response = yield* Effect.promise((signal) =>
        wrapRequestHandler({ options, request, context: execution.raw, captureErrors: false }, () => {
          const scopes = {
            isolationScope: Sentry.getIsolationScope(),
            scope: Sentry.getCurrentScope(),
          };

          const run = Effect.runPromiseWith(context);

          return run(Effect.provideService(handled, SentryScope, scopes), { signal });
        }),
      );

      return HttpServerResponse.fromWeb(response);
    });
};
