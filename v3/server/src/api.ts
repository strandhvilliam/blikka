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
import { Auth, AuthConfig, AuthenticatedLive, AuthLive, EntrySessionLive } from "./auth/Auth.ts";
import { CurrentUser } from "./auth/CurrentUser.ts";
import { CompetitionsHandlers } from "./competitions/handlers.ts";
import { CompetitionsService } from "./competitions/service.ts";
import { EntryHandlers } from "./entry/handlers.ts";
import { EntryService } from "./entry/service.ts";
import { ParticipantsHandlers } from "./participants/handlers.ts";
import { ParticipantsService } from "./participants/service.ts";
import { SubmissionsHandlers } from "./submissions/handlers.ts";
import { SubmissionsService } from "./submissions/service.ts";
import { TopicsHandlers } from "./topics/handlers.ts";
import { TopicsService } from "./topics/service.ts";
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

const Handlers = Layer.mergeAll(
  UsersHandlers,
  OrganizationsHandlers,
  CompetitionsHandlers,
  TopicsHandlers,
  EntryHandlers,
  ParticipantsHandlers,
  SubmissionsHandlers,
  InvitationsHandlers,
  MembersHandlers,
).pipe(Layer.provide(Layer.mergeAll(AuthenticatedLive, EntrySessionLive)));

const AuthRoute = HttpRouter.add(
  "*",
  "/auth/*",
  Effect.gen(function* () {
    const auth = yield* Auth;

    return yield* HttpEffect.fromWebHandler(auth.handler);
  }),
);

const ApiRoutes = HttpApiBuilder.layer(Contract, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(Handlers),
  Layer.provide(HttpServer.layerServices),
);

const Routes = Layer.mergeAll(AuthRoute, ApiRoutes);

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
    const database = yield* Database;
    const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(database);
    const authConfig = yield* AuthConfig;
    const hostnames = yield* Hostnames;
    const cookieDomain = hostnames?.website;
    const sentryDsn = yield* SentryDsn;
    const sentry = { dsn: Option.getOrUndefined(sentryDsn), environment: yield* Stage };

    const cors = HttpRouter.cors({ allowedOrigins: [authConfig.websiteURL], credentials: true });
    const handler = yield* HttpRouter.toHttpEffect(Layer.mergeAll(Routes, cors));

    // Built per request, like the Db they read.
    const services = Layer.mergeAll(
      // Auth claims guest entries on sign-in (adr/0004), through ParticipantsService.
      AuthLive(authConfig, cookieDomain).pipe(Layer.provideMerge(ParticipantsService.layer)),
      OrganizationsService.layer,
      CompetitionsService.layer,
      TopicsService.layer,
      EntryService.layer,
      SubmissionsService.layer,
      InvitationsService.layer,
      MembersService.layer,
    ).pipe(Layer.provide(PermissionsService.layer), Layer.provide(DbLive(hyperdrive)));

    return {
      fetch: handler.pipe(Effect.provide(services), withSentry(sentry), Effect.withSpan("Api.fetch")),
    };
  }).pipe(Effect.provide(Cloudflare.Hyperdrive.ConnectBinding), Effect.provide(Telemetry)),
) {}
