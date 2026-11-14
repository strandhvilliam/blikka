import { expect, test } from "bun:test";
import { Permission, permissionsOf, ROLE_PERMISSIONS, rolesWith } from "./permissions.ts";

test("each role's exact permissions", () => {
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
  expect(ROLE_PERMISSIONS).toEqual({ owner: admin, admin });
});

test("no role denies every permission", () => {
  for (const permission of Permission.literals) {
    expect(permissionsOf(undefined).includes(permission)).toBe(false);
  }
});

test("rolesWith lists the roles a permission belongs to, and none for the jury's", () => {
  expect(rolesWith("competitions:read")).toEqual(["owner", "admin"]);
  expect(rolesWith("jury:rate")).toEqual([]);
});
