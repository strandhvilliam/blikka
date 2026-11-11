import * as Schema from "effect/Schema";

// Who may do what (adr/0001-roles-and-permissions.md). This file is the spec, and
// permissions.test.ts pins each role's exact set. Schemas only, so the contract can import it.
// auth/authorize.ts enforces it.

export const Permission = Schema.Literals([
  "organization:read",
  "organization:write",
  "members:read",
  "members:write",
  "competitions:read",
  "competitions:write",
  "participants:read",
  "participants:write",
  "submissions:read",
  "submissions:write",
  "jury:read",
  "jury:write",
  "jury:rate",
]);
export type Permission = typeof Permission.Type;

export const Role = Schema.Literals(["owner", "admin"]);
export type Role = typeof Role.Type;

// Everything for the organization and its competitions. Not jury:rate, which is the jury's.
const admin: ReadonlyArray<Permission> = [
  "organization:read",
  "organization:write",
  "members:read",
  "members:write",
  "competitions:read",
  "competitions:write",
  "participants:read",
  "participants:write",
  "submissions:read",
  "submissions:write",
  "jury:read",
  "jury:write",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlyArray<Permission>> = {
  // The owner differs from admin only by invariants (one owner, can't be demoted), not permissions.
  owner: admin,
  admin,
};

// No role (not a member, or the organization is deleted) has no permissions: deny by default.
export const permissionsOf = (role: Role | undefined): ReadonlyArray<Permission> =>
  role ? ROLE_PERMISSIONS[role] : [];
