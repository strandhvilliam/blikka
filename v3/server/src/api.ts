import * as Cloudflare from "@alchemy.run/cloudflare";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpEffect from "effect/http/HttpEffect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import { Hostnames } from "../../domain.ts";
import { Auth, AuthConfig, AuthLive, requireUser } from "./auth.ts";
import { Api as Contract } from "./contract.ts";
import { Database, DbLive } from "./db.ts";
import { SentryDsn, SentrySourceMaps, Telemetry } from "./observability.ts";
import { withSentry } from "./sentry.ts";

const UsersHandlers = HttpApiBuilder.group(Contract, "users", (handlers) =>
  handlers.handle("me", () => Effect.map(requireUser(), (user) => ({ user }))),
);

const Routes = Layer.mergeAll(
  // Better Auth serves its own endpoints, so they stay outside the contract.
  HttpRouter.add(
    "*",
    "/auth/*",
    Effect.gen(function* () {
      const auth = yield* Auth;
      return yield* HttpEffect.fromWebHandler(auth.handler);
    }),
  ),
  HttpApiBuilder.layer(Contract, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(UsersHandlers),
    Layer.provide(HttpServer.layerServices),
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
    const cookieDomain = (yield* Hostnames)?.website;
    const sentry = { dsn: Option.getOrUndefined(yield* SentryDsn), environment: yield* Stage };
    const handler = yield* HttpRouter.toHttpEffect(
      Layer.mergeAll(
        Routes,
        HttpRouter.cors({ allowedOrigins: [authConfig.websiteURL], credentials: true }),
      ),
    );
    return {
      fetch: handler.pipe(
        Effect.provide(
          AuthLive(authConfig, cookieDomain).pipe(Layer.provideMerge(DbLive(hyperdrive))),
        ),
        // Reports unexpected errors and turns every error into a response (Unauthorized → 401, else 500).
        withSentry(sentry),
        Effect.withSpan("Api.fetch"),
      ),
    };
  }).pipe(
    Effect.provide(Cloudflare.Hyperdrive.ConnectBinding),
    Effect.provide(Telemetry),
  ),
) {}
