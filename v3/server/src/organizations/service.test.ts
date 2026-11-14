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
