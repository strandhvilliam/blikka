import * as Axiom from "@alchemy.run/axiom";
import * as Cloudflare from "@alchemy.run/cloudflare";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpEffect from "effect/http/HttpEffect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { Hostnames } from "../domain.ts";
import { Auth, AuthConfig, AuthLive, requireUser } from "./auth.ts";
import { Database, DbLive } from "./db.ts";
import { Ingest, Logs, SentryDsn, SentrySourceMaps, Traces } from "./observability.ts";
import { withSentry } from "./sentry.ts";

const Routes = Layer.mergeAll(
  HttpRouter.add(
    "*",
    "/auth/*",
    Effect.gen(function* () {
      const auth = yield* Auth;
      return yield* HttpEffect.fromWebHandler(auth.handler);
    }),
  ),
  HttpRouter.add(
    "GET",
    "/me",
    Effect.gen(function* () {
      const user = yield* requireUser();
      return yield* HttpServerResponse.json({ user });
    }),
  ),
);

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  Effect.gen(function* () {
    return {
      main: import.meta.url,
      domain: (yield* Hostnames)?.api,
      build: yield* SentrySourceMaps,
    };
  }),
  Effect.gen(function* () {
    const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(yield* Database);
    const authConfig = yield* AuthConfig;
    const sentry = { dsn: Option.getOrUndefined(yield* SentryDsn), environment: yield* Stage };
    const handler = yield* HttpRouter.toHttpEffect(
      Layer.mergeAll(
        Routes,
        HttpRouter.cors({ allowedOrigins: [authConfig.websiteURL], credentials: true }),
      ),
    );
    return {
      fetch: handler.pipe(
        Effect.provide(AuthLive(authConfig).pipe(Layer.provideMerge(DbLive(hyperdrive)))),
        // Reports unexpected errors and turns every error into a response (Unauthorized → 401, else 500).
        withSentry(sentry),
        Effect.withSpan("Api.fetch"),
      ),
    };
  }).pipe(
    Effect.provide(Cloudflare.Hyperdrive.ConnectBinding),
    Effect.provide(Axiom.Telemetry({ token: Ingest, traces: Traces, logs: Logs })),
  ),
) {}
