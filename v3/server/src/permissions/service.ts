import { and, eq, isNull } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { OrganizationNotFound } from "../organizations/schemas.ts";
import { permissionsOf, PermissionDenied, type Permission } from "./permissions.ts";

export class Permissions extends Context.Service<Permissions>()("blikka/permissions/Permissions", {
  make: Effect.gen(function* () {
    const db = yield* Db;

    // Succeeds with the caller's permissions, so the website can hide what the Api would refuse.
    const authorize = Effect.fn("Permissions.authorize")(function* (
      caller: User,
      permission: Permission,
      organizationId: string,
    ) {
      const [membership] = yield* Effect.promise(() =>
        db
          .select({ role: model.organizationMembers.role })
          .from(model.organizationMembers)
          .innerJoin(
            model.organizations,
            eq(model.organizations.id, model.organizationMembers.organizationId),
          )
          .where(
            and(
              eq(model.organizationMembers.organizationId, organizationId),
              eq(model.organizationMembers.userId, caller.id),
              isNull(model.organizations.deletedAt),
            ),
          ),
      );
      if (!membership) return yield* new OrganizationNotFound();
      const permissions = permissionsOf(membership.role);
      if (!permissions.includes(permission)) return yield* new PermissionDenied();
      return permissions;
    });

    return { authorize };
  }),
}) {
  static readonly layer = Layer.effect(Permissions, Permissions.make);
}
