import { expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import * as model from "../db/model.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import { OrganizationsService } from "./service.ts";

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const admin = await createUser(tx, "Admin");
  const organizationId = await createOrganization(tx, owner);
  await tx.insert(model.organizationMembers).values({ organizationId, userId: admin.id, role: "admin" });
  return { ...runner(tx, OrganizationsService, OrganizationsService.layer), owner, admin, organizationId };
};

test("get returns the caller's role with their permissions", () =>
  rolledBack(async (tx) => {
    const { run, owner, admin, organizationId } = await setup(tx);
    expect(await run((s) => s.get(owner, organizationId))).toMatchObject({ id: organizationId, role: "owner" });
    expect(await run((s) => s.get(admin, organizationId))).toMatchObject({ id: organizationId, role: "admin" });
  }));

test("an admin renames the organization; an outsider can't", () =>
  rolledBack(async (tx) => {
    const { run, fails, admin, organizationId } = await setup(tx);
    expect(await run((s) => s.update(admin, organizationId, "Camera Club"))).toEqual({ id: organizationId, name: "Camera Club" });
    const stranger = await createUser(tx, "Stranger");
    expect(await fails((s) => s.update(stranger, organizationId, "Mine"))).toBe("OrganizationNotFound");
  }));

test("only the owner deletes the organization, and then nobody reaches it", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, admin, organizationId } = await setup(tx);
    expect(await fails((s) => s.remove(admin, organizationId))).toBe("PermissionDenied");
    await run((s) => s.remove(owner, organizationId));
    expect(await fails((s) => s.get(owner, organizationId))).toBe("OrganizationNotFound");
    expect(await fails((s) => s.update(admin, organizationId, "Back"))).toBe("OrganizationNotFound");
    expect(await fails((s) => s.remove(owner, organizationId))).toBe("OrganizationNotFound");
    expect(await run((s) => s.list(owner))).toEqual([]);
  }));

test("a removed member gets nothing from the organization", () =>
  rolledBack(async (tx) => {
    const { run, fails, admin, organizationId } = await setup(tx);
    await tx
      .update(model.organizationMembers)
      .set({ deletedAt: new Date() })
      .where(and(eq(model.organizationMembers.organizationId, organizationId), eq(model.organizationMembers.userId, admin.id)));
    expect(await run((s) => s.list(admin))).toEqual([]);
    expect(await fails((s) => s.get(admin, organizationId))).toBe("OrganizationNotFound");
  }));
