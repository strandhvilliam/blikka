import { and, eq, isNull, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db, transaction } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionDenied } from "../permissions/permissions.ts";
import { PermissionsService } from "../permissions/service.ts";
import { OrganizationNotFound } from "./schemas.ts";

const columns = { id: model.organizations.id, name: model.organizations.name };

export class OrganizationsService extends Context.Service<OrganizationsService>()("blikka/organizations/OrganizationsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { authorize } = yield* PermissionsService;

    // Effect.promise: database failures are defects (500), not domain errors.
    const list = Effect.fn("OrganizationsService.list")(function* (caller: User) {
      return yield* Effect.promise(() =>
        db
          .select({ ...columns, role: model.organizationMembers.role })
          .from(model.organizations)
          .innerJoin(
            model.organizationMembers,
            eq(model.organizationMembers.organizationId, model.organizations.id),
          )
          .where(
            and(
              eq(model.organizationMembers.userId, caller.id),
              isNull(model.organizationMembers.deletedAt),
              isNull(model.organizations.deletedAt),
            ),
          )
          // uuidv7 ids sort by creation time.
          .orderBy(model.organizations.id),
      );
    });

    // Any signed-in user may create an organization; Authenticated already guarantees that.
    const create = Effect.fn("OrganizationsService.create")(function* (caller: User, name: string) {
      return yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          const [organization] = yield* Effect.promise(() =>
            tx.insert(model.organizations).values({ name }).returning(columns),
          );
          yield* Effect.promise(() =>
            tx
              .insert(model.organizationMembers)
              .values({ organizationId: organization!.id, userId: caller.id, role: "owner" }),
          );
          return organization!;
        }),
      );
    });

    const get = Effect.fn("OrganizationsService.get")(function* (caller: User, id: string) {
      const { role, permissions } = yield* authorize(caller, "organization:read", id);
      const [organization] = yield* Effect.promise(() =>
        db.select(columns).from(model.organizations).where(eq(model.organizations.id, id)),
      );
      return { ...organization!, role, permissions };
    });

    const update = Effect.fn("OrganizationsService.update")(function* (caller: User, id: string, name: string) {
      yield* authorize(caller, "organization:write", id);
      const [organization] = yield* Effect.promise(() =>
        db
          .update(model.organizations)
          .set({ name, updatedAt: sql`now()` })
          .where(and(eq(model.organizations.id, id), isNull(model.organizations.deletedAt)))
          .returning(columns),
      );
      // Deleted since the check.
      if (!organization) {
        return yield* new OrganizationNotFound();
      }
      return organization;
    });

    // Only the owner deletes (adr/0008). Everything under the organization goes with it, since reads skip it.
    const remove = Effect.fn("OrganizationsService.remove")(function* (caller: User, id: string) {
      const { role } = yield* authorize(caller, "organization:write", id);
      if (role !== "owner") {
        return yield* new PermissionDenied();
      }
      yield* Effect.promise(() =>
        db
          .update(model.organizations)
          .set({ deletedAt: sql`now()` })
          .where(and(eq(model.organizations.id, id), isNull(model.organizations.deletedAt))),
      );
    });

    return { list, create, get, update, remove };
  }),
}) {
  static readonly layer = Layer.effect(OrganizationsService, OrganizationsService.make);
}
