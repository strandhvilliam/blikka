import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { OrganizationNotFound } from "../organizations/schemas.ts";
import { permissionsOf, PermissionDenied, rolesWith, type Permission } from "./permissions.ts";

const members = model.organizationMembers;

// A removed membership or a deleted organization grants nothing (adr/0001).
const activeMembershipOf = (caller: User) =>
  and(eq(members.userId, caller.id), isNull(members.deletedAt), isNull(model.organizations.deletedAt));

export class PermissionsService extends Context.Service<PermissionsService>()("blikka/permissions/PermissionsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;

    // Succeeds with the caller's role and permissions: the website hides what the Api would refuse,
    // and the owner's invariants (adr/0001), which no permission expresses, check the role.
    const authorize = Effect.fn("PermissionsService.authorize")(function* (
      caller: User,
      permission: Permission,
      organizationId: string,
    ) {
      const [membership] = yield* Effect.promise(() =>
        db
          .select({ role: members.role })
          .from(members)
          .innerJoin(model.organizations, eq(model.organizations.id, members.organizationId))
          .where(and(eq(members.organizationId, organizationId), activeMembershipOf(caller))),
      );
      if (!membership) return yield* new OrganizationNotFound();
      const permissions = permissionsOf(membership.role);
      if (!permissions.includes(permission)) return yield* new PermissionDenied();
      return { role: membership.role, permissions };
    });

    // The organizations where the caller's role grants the permission, as a subquery for `inArray`.
    // Reads filter by it, so a row in someone else's organization looks like one that doesn't exist.
    const selectAccessibleOrganizationIds = (caller: User, permission: Permission) =>
      db
        .select({ id: members.organizationId })
        .from(members)
        .innerJoin(model.organizations, eq(model.organizations.id, members.organizationId))
        .where(and(activeMembershipOf(caller), inArray(members.role, rolesWith(permission))));

    return { authorize, selectAccessibleOrganizationIds };
  }),
}) {
  static readonly layer = Layer.effect(PermissionsService, PermissionsService.make);
}
