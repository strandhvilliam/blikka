import { and, eq, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as HttpApiError from "effect/http-api/HttpApiError";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { permissionsOf, type Permission } from "../permissions.ts";

// The one check (adr/0001-roles-and-permissions.md). Succeeds with the caller's permissions in the
// organization, so the website can hide what the Api would refuse. Not a member, or a deleted
// organization, is NotFound, so outsiders can't tell whether it exists. A member without the
// permission is Forbidden.
export const authorize = Effect.fn("authorize")(function* (
  caller: typeof User.Type,
  permission: Permission,
  organizationId: string,
) {
  const db = yield* Db;
  // Database failures are infrastructure failures, so Effect.promise makes them defects → 500.
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
  if (!membership) return yield* new HttpApiError.NotFound();
  const permissions = permissionsOf(membership.role);
  if (!permissions.includes(permission)) return yield* new HttpApiError.Forbidden();
  return permissions;
});

// Any signed-in user may create an organization and becomes its owner. Named, so the create
// handler reads as checked rather than as a route that forgot its check.
export const authorizeCreateOrganization = (_caller: typeof User.Type) => Effect.void;
