import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { OrganizationNotFound } from "../organizations/schemas.ts";
import { permissionsOf, PermissionDenied, rolesWith, type Permission } from "./permissions.ts";

export class PermissionsService extends Context.Service<PermissionsService>()("blikka/permissions/PermissionsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;

    // Succeeds with the caller's permissions, so the website can hide what the Api would refuse.
    const authorize = Effect.fn("PermissionsService.authorize")(function* (
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

    // The organizations where the caller's role grants the permission, as a subquery for `inArray`.
    // Reads filter by it, so a row in someone else's organization looks like one that doesn't exist.
    const selectAccessibleOrganizationIds = (caller: User, permission: Permission) =>
      db
        .select({ id: model.organizationMembers.organizationId })
        .from(model.organizationMembers)
        .innerJoin(model.organizations, eq(model.organizations.id, model.organizationMembers.organizationId))
        .where(
          and(
            eq(model.organizationMembers.userId, caller.id),
            inArray(model.organizationMembers.role, rolesWith(permission)),
            isNull(model.organizations.deletedAt),
          ),
        );

    return { authorize, selectAccessibleOrganizationIds };
  }),
}) {
  static readonly layer = Layer.effect(PermissionsService, PermissionsService.make);
}
