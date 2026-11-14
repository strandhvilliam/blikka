import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import * as model from "../db/model.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import { InvitationsService } from "./service.ts";

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const invitee = await createUser(tx, "Invitee");
  const organizationId = await createOrganization(tx, owner);
  return { ...runner(tx, InvitationsService, InvitationsService.layer), owner, invitee, organizationId };
};

test("an admin invites an email, lowercased, and inviting it again renews the same invitation", () =>
  rolledBack(async (tx) => {
    const { run, owner, invitee, organizationId } = await setup(tx);
    const first = await run((s) => s.create(owner, organizationId, invitee.email.toUpperCase()));
    expect(first.email).toBe(invitee.email.toLowerCase());
    expect(first.organization_id).toBe(organizationId);
    const second = await run((s) => s.create(owner, organizationId, invitee.email));
    expect(second.id).toBe(first.id);
  }));

test("inviting a member is a 409, and a non-member can't invite", () =>
  rolledBack(async (tx) => {
    const { fails, owner, organizationId } = await setup(tx);
    expect(await fails((s) => s.create(owner, organizationId, owner.email))).toBe("AlreadyMember");
    const stranger = await createUser(tx, "Stranger");
    expect(await fails((s) => s.create(stranger, organizationId, "someone@blikka.test"))).toBe("OrganizationNotFound");
  }));

test("the invited person sees the invitation, with the organization and who sent it", () =>
  rolledBack(async (tx) => {
    const { run, owner, invitee, organizationId } = await setup(tx);
    const { id } = await run((s) => s.create(owner, organizationId, invitee.email));
    const received = await run((s) => s.received(invitee));
    expect(received.map(({ expires_at: _, ...rest }) => rest)).toEqual([
      { id, organization: { id: organizationId, name: "Photo Club" }, invited_by: { name: "Owner" } },
    ]);
    expect(await run((s) => s.received(owner))).toEqual([]);
  }));

test("an unverified email, an expired or a revoked invitation can't be seen or accepted", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, invitee, organizationId } = await setup(tx);
    const { id } = await run((s) => s.create(owner, organizationId, invitee.email));
    const invitation = eq(model.organizationInvitations.id, id);

    await tx.update(model.user).set({ emailVerified: false }).where(eq(model.user.id, invitee.id));
    expect(await run((s) => s.received(invitee))).toEqual([]);
    expect(await fails((s) => s.accept(invitee, id))).toBe("InvitationNotFound");
    await tx.update(model.user).set({ emailVerified: true }).where(eq(model.user.id, invitee.id));

    await tx.update(model.organizationInvitations).set({ expiresAt: sql`now() - interval '1 second'` }).where(invitation);
    expect(await run((s) => s.received(invitee))).toEqual([]);
    expect(await fails((s) => s.accept(invitee, id))).toBe("InvitationNotFound");

    await tx
      .update(model.organizationInvitations)
      .set({ expiresAt: sql`now() + interval '1 day'`, revokedAt: sql`now()` })
      .where(invitation);
    expect(await run((s) => s.received(invitee))).toEqual([]);
    expect(await fails((s) => s.accept(invitee, id))).toBe("InvitationNotFound");
  }));

test("only the invited person can accept, once, and it makes them an admin", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, invitee, organizationId } = await setup(tx);
    const { id } = await run((s) => s.create(owner, organizationId, invitee.email));
    const someoneElse = await createUser(tx, "Someone");
    expect(await fails((s) => s.accept(someoneElse, id))).toBe("InvitationNotFound");

    expect(await run((s) => s.accept(invitee, id))).toEqual({ organization_id: organizationId });
    const [member] = await tx
      .select({ role: model.organizationMembers.role })
      .from(model.organizationMembers)
      .where(eq(model.organizationMembers.userId, invitee.id));
    expect(member).toEqual({ role: "admin" });

    expect(await run((s) => s.received(invitee))).toEqual([]);
    expect(await fails((s) => s.accept(invitee, id))).toBe("InvitationNotFound");
    expect(await fails((s) => s.create(owner, organizationId, invitee.email))).toBe("AlreadyMember");
  }));
