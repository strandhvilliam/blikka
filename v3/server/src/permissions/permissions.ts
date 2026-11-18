import * as Schema from "effect/Schema";

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
  "judging:read",
  "judging:write",
]);

export type Permission = typeof Permission.Type;

export const Role = Schema.Literals(["owner", "admin"]);

export type Role = typeof Role.Type;

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
  "judging:read",
  "judging:write",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlyArray<Permission>> = {
  owner: admin,
  admin,
};

export const permissionsOf = (role: Role | undefined): ReadonlyArray<Permission> =>
  role ? ROLE_PERMISSIONS[role] : [];

export const rolesWith = (permission: Permission): Array<Role> =>
  Role.literals.filter((role) => ROLE_PERMISSIONS[role].includes(permission));

export class PermissionDenied extends Schema.TaggedError<PermissionDenied>()(
  "PermissionDenied",
  {},
  { httpApiStatus: 403 },
) {}
