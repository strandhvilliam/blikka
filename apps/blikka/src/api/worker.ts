import * as Axiom from "@alchemy.run/axiom";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpEffect from "effect/http/HttpEffect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { Auth, AuthConfig, AuthLive, requireUser } from "./auth.ts";
import { Database, DbLive } from "./db.ts";
import { Ingest, Logs, Traces } from "./observability.ts";

const Routes = Layer.mergeAll(
  HttpRouter.add(
    "*",
    "/api/auth/*",
    Effect.gen(function* () {
      const auth = yield* Auth;
      return yield* HttpEffect.fromWebHandler(auth.handler);
    }),
  ),
  HttpRouter.add(
    "GET",
    "/api/me",
    Effect.gen(function* () {
      const user = yield* requireUser();
      return yield* HttpServerResponse.json({ user });
    }),
  ),
);

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  { main: import.meta.url },
  Effect.gen(function* () {
    const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(yield* Database);
    const authConfig = yield* AuthConfig;
    const handler = yield* HttpRouter.toHttpEffect(Routes);
    return {
      fetch: handler.pipe(
        // Typed errors that know their response (Unauthorized → 401) use it; anything else is a 500.
        Effect.catch((error) =>
          HttpServerRespondable.toResponseOrElse(error, HttpServerResponse.empty({ status: 500 })),
        ),
        Effect.provide(AuthLive(authConfig).pipe(Layer.provideMerge(DbLive(hyperdrive)))),
        Effect.withSpan("Api.fetch"),
      ),
    };
  }).pipe(
    Effect.provide(Cloudflare.Hyperdrive.ConnectBinding),
    Effect.provide(Axiom.Telemetry({ token: Ingest, traces: Traces, logs: Logs })),
  ),
) {}
