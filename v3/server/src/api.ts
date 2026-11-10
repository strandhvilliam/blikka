import * as Cloudflare from "@alchemy.run/cloudflare";
import { Stage } from "alchemy/Stage";
import { and, eq, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpEffect from "effect/http/HttpEffect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import { Hostnames } from "../../domain.ts";
import { Auth, AuthConfig, AuthenticatedLive, AuthLive } from "./auth/Auth.ts";
import { CurrentUser } from "./auth/CurrentUser.ts";
import { Api as Contract } from "./contract.ts";
import { Database, Db, DbLive } from "./db/Db.ts";
import * as model from "./db/model.ts";
import { SentryDsn, SentrySourceMaps, Telemetry } from "./observability.ts";
import { withSentry } from "./sentry/SentryScope.ts";

const UsersHandlers = HttpApiBuilder.group(Contract, "users", (handlers) =>
  handlers.handle("me", () => CurrentUser.useSync((user) => ({ user }))),
);

const organizationColumns = { id: model.organizations.id, name: model.organizations.name };

// Database failures are infrastructure failures, so Effect.promise makes them defects → 500.
const OrganizationsHandlers = HttpApiBuilder.group(Contract, "organizations", (handlers) =>
  handlers
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const db = yield* Db;
        return yield* Effect.promise(() =>
          db.transaction(async (tx) => {
            const [organization] = await tx
              .insert(model.organizations)
              .values({ name: payload.name })
              .returning(organizationColumns);
            // Exactly one owner per organization (adr/0001-roles-and-permissions.md).
            await tx
              .insert(model.organizationMembers)
              .values({ organizationId: organization!.id, userId: user.id, role: "owner" });
            return organization!;
          }),
        );
      }),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const db = yield* Db;
        const [organization] = yield* Effect.promise(() =>
          db
            .select(organizationColumns)
            .from(model.organizations)
            .innerJoin(
              model.organizationMembers,
              eq(model.organizationMembers.organizationId, model.organizations.id),
            )
            .where(
              and(
                eq(model.organizations.id, params.id),
                eq(model.organizationMembers.userId, user.id),
                isNull(model.organizations.deletedAt),
              ),
            ),
        );
        if (!organization) return yield* new HttpApiError.NotFound();
        return organization;
      }),
    ),
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
    Layer.provide(
      Layer.mergeAll(UsersHandlers, OrganizationsHandlers).pipe(Layer.provide(AuthenticatedLive)),
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
