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
import { Auth, AuthConfig, AuthenticatedLive, AuthLive } from "./auth/Auth.ts";
import { CurrentUser } from "./auth/CurrentUser.ts";
import { CompetitionsHandlers } from "./competitions/handlers.ts";
import { CompetitionsService } from "./competitions/service.ts";
import { Api as Contract } from "./contract.ts";
import { Database, DbLive } from "./db/Db.ts";
import { InvitationsHandlers } from "./invitations/handlers.ts";
import { InvitationsService } from "./invitations/service.ts";
import { MembersHandlers } from "./members/handlers.ts";
import { MembersService } from "./members/service.ts";
import { OrganizationsHandlers } from "./organizations/handlers.ts";
import { OrganizationsService } from "./organizations/service.ts";
import { PermissionsService } from "./permissions/service.ts";
import { SentryDsn, SentrySourceMaps, Telemetry } from "./observability.ts";
import { withSentry } from "./sentry/SentryScope.ts";

const UsersHandlers = HttpApiBuilder.group(Contract, "users", (handlers) =>
  handlers.handle("me", () => CurrentUser.useSync((user) => ({ user }))),
);

const Routes = Layer.mergeAll(
  HttpRouter.add(
    "*",
    "/auth/*",
    Effect.gen(function* () {
      const auth = yield* Auth;
      return yield* HttpEffect.fromWebHandler(auth.handler);
    }),
  ),
  HttpApiBuilder.layer(Contract, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(
      Layer.mergeAll(
        UsersHandlers,
        OrganizationsHandlers,
        CompetitionsHandlers,
        InvitationsHandlers,
        MembersHandlers,
      ).pipe(Layer.provide(AuthenticatedLive)),
    ),
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
          Layer.mergeAll(
            AuthLive(authConfig, cookieDomain),
            OrganizationsService.layer,
            CompetitionsService.layer,
            InvitationsService.layer,
            MembersService.layer,
          ).pipe(
            Layer.provide(PermissionsService.layer),
            Layer.provide(DbLive(hyperdrive)),
          ),
        ),
        withSentry(sentry),
        Effect.withSpan("Api.fetch"),
      ),
    };
  }).pipe(
    Effect.provide(Cloudflare.Hyperdrive.ConnectBinding),
    Effect.provide(Telemetry),
  ),
) {}
