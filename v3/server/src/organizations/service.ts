import { and, eq, isNull } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";

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
          .where(and(eq(model.organizationMembers.userId, caller.id), isNull(model.organizations.deletedAt)))
          // uuidv7 ids sort by creation time.
          .orderBy(model.organizations.id),
      );
    });

    // Any signed-in user may create an organization; Authenticated already guarantees that.
    const create = Effect.fn("OrganizationsService.create")(function* (caller: User, name: string) {
      return yield* Effect.promise(() =>
        db.transaction(async (tx) => {
          const [organization] = await tx.insert(model.organizations).values({ name }).returning(columns);
          await tx
            .insert(model.organizationMembers)
            .values({ organizationId: organization!.id, userId: caller.id, role: "owner" });
          return organization!;
        }),
      );
    });

    const get = Effect.fn("OrganizationsService.get")(function* (caller: User, id: string) {
      const permissions = yield* authorize(caller, "organization:read", id);
      const [organization] = yield* Effect.promise(() =>
        db.select(columns).from(model.organizations).where(eq(model.organizations.id, id)),
      );
      return { ...organization!, permissions };
    });

    return { list, create, get };
  }),
}) {
  static readonly layer = Layer.effect(OrganizationsService, OrganizationsService.make);
}
