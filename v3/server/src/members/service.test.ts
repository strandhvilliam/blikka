import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import * as model from "../db/model.ts";
import { createOrganization, createUser, rolledBack, runner } from "../db/testDb.ts";
import { Member } from "./schemas.ts";
import { MembersService } from "./service.ts";

test("members are listed oldest first, only for organizations the caller belongs to", () =>
  rolledBack(async (tx) => {
    const { run } = runner(tx, MembersService, MembersService.layer);
    const owner = await createUser(tx, "Owner");
    const admin = await createUser(tx, "Admin");
    const organizationId = await createOrganization(tx, owner);
    await tx.insert(model.organizationMembers).values({ organizationId, userId: admin.id, role: "admin" });
    const stranger = await createUser(tx, "Stranger");
    const otherOrganizationId = await createOrganization(tx, stranger);

    const expected: Array<typeof Member.Type> = [
      { user_id: owner.id, organization_id: organizationId, name: "Owner", email: owner.email, role: "owner" },
      { user_id: admin.id, organization_id: organizationId, name: "Admin", email: admin.email, role: "admin" },
    ];
    expect(await run((s) => s.list(admin, organizationId))).toEqual(expected);
    expect(await run((s) => s.list(owner))).toEqual(expected);
    expect(await run((s) => s.list(owner, otherOrganizationId))).toEqual([]);
    expect(await run((s) => s.list(stranger, organizationId))).toEqual([]);

    await tx.update(model.organizations).set({ deletedAt: new Date() }).where(eq(model.organizations.id, organizationId));
    expect(await run((s) => s.list(owner, organizationId))).toEqual([]);
  }));
