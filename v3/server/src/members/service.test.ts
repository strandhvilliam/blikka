import { expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import * as model from "../db/model.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import { InvitationsService } from "../invitations/service.ts";
import { Member } from "./schemas.ts";
import { MembersService } from "./service.ts";

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const admin = await createUser(tx, "Admin");
  const organizationId = await createOrganization(tx, owner);
  await tx.insert(model.organizationMembers).values({ organizationId, userId: admin.id, role: "admin" });

  return { ...runner(tx, MembersService, MembersService.layer), owner, admin, organizationId };
};

test("members are listed oldest first, only for organizations the caller belongs to", () =>
  rolledBack(async (tx) => {
    const { run, owner, admin, organizationId } = await setup(tx);
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

    await tx
      .update(model.organizations)
      .set({ deletedAt: new Date() })
      .where(eq(model.organizations.id, organizationId));
    expect(await run((s) => s.list(owner, organizationId))).toEqual([]);
  }));

test("an admin removes another admin, who drops out of the list and loses access", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, admin, organizationId } = await setup(tx);
    const other = await createUser(tx, "Other");
    await tx.insert(model.organizationMembers).values({ organizationId, userId: other.id, role: "admin" });

    await run((s) => s.remove(admin, organizationId, other.id));
    expect((await run((s) => s.list(owner, organizationId))).map((m) => m.user_id)).toEqual([owner.id, admin.id]);
    expect(await run((s) => s.list(other))).toEqual([]);
    // Gone already, and a removed member can't act any more.
    expect(await fails((s) => s.remove(admin, organizationId, other.id))).toBe("MemberNotFound");
    expect(await fails((s) => s.remove(other, organizationId, admin.id))).toBe("MemberNotFound");
  }));

test("removing an admin revokes the invitations they sent and haven't been accepted", () =>
  rolledBack(async (tx) => {
    const { run, owner, admin, organizationId } = await setup(tx);
    const invitations = runner(tx, InvitationsService, InvitationsService.layer);
    const invitee = await createUser(tx, "Invitee");
    const fromAdmin = await invitations.run((s) => s.create(admin, organizationId, invitee.email));
    const fromOwner = await invitations.run((s) => s.create(owner, organizationId, "someone@blikka.test"));

    await run((s) => s.remove(owner, organizationId, admin.id));

    expect(await invitations.fails((s) => s.accept(invitee, fromAdmin.id))).toBe("InvitationNotFound");
    expect((await invitations.run((s) => s.list(owner, organizationId))).map((i) => i.id)).toEqual([fromOwner.id]);
  }));

test("an admin leaves by removing themselves; the owner can't leave or be removed", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, admin, organizationId } = await setup(tx);
    expect(await fails((s) => s.remove(owner, organizationId, owner.id))).toBe("OwnerCannotBeRemoved");
    expect(await fails((s) => s.remove(admin, organizationId, owner.id))).toBe("OwnerCannotBeRemoved");

    await run((s) => s.remove(admin, organizationId, admin.id));
    expect((await run((s) => s.list(owner, organizationId))).map((m) => m.user_id)).toEqual([owner.id]);

    const [row] = await tx
      .select()
      .from(model.organizationMembers)
      .where(
        and(
          eq(model.organizationMembers.organizationId, organizationId),
          eq(model.organizationMembers.userId, admin.id),
        ),
      );

    // Kept as a record, marked removed.
    expect(row?.deletedAt).toBeInstanceOf(Date);
  }));

test("outsiders can't remove anyone, and can't tell whether the member exists", () =>
  rolledBack(async (tx) => {
    const { fails, admin, organizationId } = await setup(tx);
    const stranger = await createUser(tx, "Stranger");
    const otherOrganizationId = await createOrganization(tx, stranger);
    expect(await fails((s) => s.remove(stranger, organizationId, admin.id))).toBe("MemberNotFound");
    expect(await fails((s) => s.remove(admin, otherOrganizationId, stranger.id))).toBe("MemberNotFound");
    expect(await fails((s) => s.remove(admin, organizationId, stranger.id))).toBe("MemberNotFound");
  }));

test("the owner hands ownership to an admin and becomes an admin", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, admin, organizationId } = await setup(tx);
    const member = await run((s) => s.transferOwnership(owner, organizationId, admin.id));
    expect(member).toEqual({
      user_id: admin.id,
      organization_id: organizationId,
      name: "Admin",
      email: admin.email,
      role: "owner",
    });
    expect((await run((s) => s.list(owner, organizationId))).map((m) => [m.user_id, m.role])).toEqual([
      [owner.id, "admin"],
      [admin.id, "owner"],
    ]);
    // The former owner is an admin now, so they can't take it back, and can leave.
    expect(await fails((s) => s.transferOwnership(owner, organizationId, owner.id))).toBe("PermissionDenied");
    await run((s) => s.remove(owner, organizationId, owner.id));
  }));

test("only the owner transfers, never to themselves, and only to a member", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, admin, organizationId } = await setup(tx);
    const stranger = await createUser(tx, "Stranger");
    await createOrganization(tx, stranger);
    expect(await fails((s) => s.transferOwnership(admin, organizationId, admin.id))).toBe("PermissionDenied");
    expect(await fails((s) => s.transferOwnership(owner, organizationId, owner.id))).toBe("PermissionDenied");
    expect(await fails((s) => s.transferOwnership(owner, organizationId, stranger.id))).toBe("MemberNotFound");
    expect(await fails((s) => s.transferOwnership(stranger, organizationId, admin.id))).toBe("MemberNotFound");

    await run((s) => s.remove(owner, organizationId, admin.id));
    expect(await fails((s) => s.transferOwnership(owner, organizationId, admin.id))).toBe("MemberNotFound");
    expect((await run((s) => s.list(owner, organizationId))).map((m) => m.role)).toEqual(["owner"]);
  }));

// The Db the service gets runs `meanwhile` right before the transfer's transaction, after the checks
// have passed: what another request could do in between.
// It replaces the method on the test's own transaction, which rolledBack discards.
const racing = (tx: Tx, meanwhile: () => Promise<void>) => {
  const transaction = tx.transaction.bind(tx);

  tx.transaction = async (body) => {
    await meanwhile();

    return transaction(body);
  };

  return tx;
};

const member = (organizationId: string, userId: string) =>
  and(eq(model.organizationMembers.organizationId, organizationId), eq(model.organizationMembers.userId, userId));

const roles = (tx: Tx, organizationId: string) =>
  tx
    .select({ userId: model.organizationMembers.userId, role: model.organizationMembers.role })
    .from(model.organizationMembers)
    .where(eq(model.organizationMembers.organizationId, organizationId))
    // created_at is the same for every row in the test's transaction; uuidv7 ids sort by creation.
    .orderBy(model.organizationMembers.userId);

test("a transfer to someone removed meanwhile rolls back, and the owner stays owner", () =>
  rolledBack(async (tx) => {
    const { owner, admin, organizationId } = await setup(tx);

    const { fails } = runner(
      racing(tx, async () => {
        await tx
          .update(model.organizationMembers)
          .set({ deletedAt: new Date() })
          .where(member(organizationId, admin.id));
      }),
      MembersService,
      MembersService.layer,
    );

    expect(await fails((s) => s.transferOwnership(owner, organizationId, admin.id))).toBe("MemberNotFound");
    expect(await roles(tx, organizationId)).toEqual([
      { userId: owner.id, role: "owner" },
      { userId: admin.id, role: "admin" },
    ]);
  }));

test("a transfer by an owner who handed it over meanwhile is refused and changes nothing", () =>
  rolledBack(async (tx) => {
    const { owner, admin, organizationId } = await setup(tx);
    const other = await createUser(tx, "Other");
    await tx.insert(model.organizationMembers).values({ organizationId, userId: other.id, role: "admin" });

    const { fails } = runner(
      racing(tx, async () => {
        await tx.update(model.organizationMembers).set({ role: "admin" }).where(member(organizationId, owner.id));
        await tx.update(model.organizationMembers).set({ role: "owner" }).where(member(organizationId, other.id));
      }),
      MembersService,
      MembersService.layer,
    );

    expect(await fails((s) => s.transferOwnership(owner, organizationId, admin.id))).toBe("PermissionDenied");
    expect(await roles(tx, organizationId)).toEqual([
      { userId: owner.id, role: "admin" },
      { userId: admin.id, role: "admin" },
      { userId: other.id, role: "owner" },
    ]);
  }));

test("the database refuses a second owner", () =>
  rolledBack(async (tx) => {
    const { admin, organizationId } = await setup(tx);

    // A savepoint, so the failure doesn't abort the test's transaction.
    const error = await tx
      .transaction((savepoint) =>
        savepoint
          .update(model.organizationMembers)
          .set({ role: "owner" })
          .where(
            and(
              eq(model.organizationMembers.organizationId, organizationId),
              eq(model.organizationMembers.userId, admin.id),
            ),
          ),
      )
      .catch((error) => error);

    expect(error?.cause?.constraint).toBe("organization_members_one_owner");
  }));
