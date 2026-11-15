import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { CompetitionsService } from "../competitions/service.ts";
import * as model from "../db/model.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import { ParticipantsService } from "../participants/service.ts";
import { EntryService } from "./service.ts";

const guest = (guestToken: string | null) => ({ user: null, guestToken });
const signedIn = (user: Parameters<EntryService["Service"]["enter"]>[0]) => ({ user, guestToken: null });

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const organizationId = await createOrganization(tx, owner);
  const competitions = runner(tx, CompetitionsService, CompetitionsService.layer);
  const { id: competitionId } = await competitions.run((c) => c.create(owner, organizationId, `Marathon ${crypto.randomUUID()}`));
  await tx.insert(model.topics).values({ competitionId, name: "Open", position: 1 });
  const publish = (published: boolean) => competitions.run((c) => c.update(owner, competitionId, { published }));
  await publish(true);
  const participants = runner(tx, ParticipantsService, ParticipantsService.layer);
  return { ...runner(tx, EntryService, EntryService.layer), participants, competitions, publish, owner, competitionId };
};

test("a guest enters with their details and owns the entry only through the token", () =>
  rolledBack(async (tx) => {
    const { run, fails, competitionId } = await setup(tx);
    const { participant, guest_token } = await run((p) =>
      p.enter(null, competitionId, { name: "Ada", email: "Ada@Example.com" }),
    );
    expect(participant).toMatchObject({ name: "Ada", email: "ada@example.com" });
    expect(guest_token).toStartWith("blikka_pgt_");
    expect(await run((p) => p.requireParticipantOwner(guest(guest_token), participant.id))).toEqual(participant);
    expect(await run((p) => p.listOwn(guest(guest_token), competitionId))).toEqual([participant]);
    expect(await fails((p) => p.requireParticipantOwner(guest("blikka_pgt_wrong"), participant.id))).toBe("ParticipantNotFound");
    expect(await fails((p) => p.requireParticipantOwner(guest(null), participant.id))).toBe("ParticipantNotFound");
  }));

test("a guest can't reuse an email or leave out their details", () =>
  rolledBack(async (tx) => {
    const { run, fails, competitionId } = await setup(tx);
    await run((p) => p.enter(null, competitionId, { name: "Ada", email: "ada@example.com" }));
    expect(await fails((p) => p.enter(null, competitionId, { name: "Eve", email: "ADA@example.com" }))).toBe("AlreadyEntered");
    expect(await fails((p) => p.enter(null, competitionId, { name: "Eve" }))).toBe("GuestDetailsRequired");
  }));

test("a draft can't be entered and looks like it doesn't exist; a closed one says so", () =>
  rolledBack(async (tx) => {
    const { fails, competitions, publish, owner, competitionId } = await setup(tx);
    const guest = { name: "Ada", email: "ada@example.com" };
    await publish(false);
    expect(await fails((p) => p.enter(null, competitionId, guest))).toBe("CompetitionNotFound");
    await publish(true);
    await competitions.run((c) => c.update(owner, competitionId, { closes_at: new Date(Date.now() - 1000) }));
    expect(await fails((p) => p.enter(null, competitionId, guest))).toBe("EntryClosed");
  }));

test("a signed-in user gets the same entry when entering again", () =>
  rolledBack(async (tx) => {
    const { run, competitionId } = await setup(tx);
    const user = await createUser(tx, "Grace");
    const first = await run((p) => p.enter(user, competitionId, { name: "ignored" }));
    expect(first).toMatchObject({ guest_token: null, participant: { name: "Grace", email: user.email.toLowerCase() } });
    expect((await run((p) => p.enter(user, competitionId, {}))).participant.id).toBe(first.participant.id);
    expect(await run((p) => p.requireParticipantOwner(signedIn(user), first.participant.id))).toEqual(first.participant);
  }));

test("signing in with a guest entry's verified email takes it over and cuts off the guest token", () =>
  rolledBack(async (tx) => {
    const { run, fails, competitionId } = await setup(tx);
    const user = await createUser(tx, "Grace");
    const entered = await run((p) => p.enter(null, competitionId, { name: "G", email: user.email }));
    const { participant } = await run((p) => p.enter(user, competitionId, {}));
    expect(participant).toMatchObject({ id: entered.participant.id, name: "Grace" });
    expect(await fails((p) => p.requireParticipantOwner(guest(entered.guest_token), participant.id))).toBe("ParticipantNotFound");
  }));

test("an unverified email doesn't take over a guest entry", () =>
  rolledBack(async (tx) => {
    const { run, fails, competitionId } = await setup(tx);
    const user = await createUser(tx, "Mallory", false);
    await run((p) => p.enter(null, competitionId, { name: "G", email: user.email }));
    expect(await fails((p) => p.enter(user, competitionId, {}))).toBe("AlreadyEntered");
  }));

test("once someone has entered, the competition can't be unpublished", () =>
  rolledBack(async (tx) => {
    const { run, competitions, owner, competitionId } = await setup(tx);
    await run((p) => p.enter(null, competitionId, { name: "Ada", email: "ada@example.com" }));
    expect(await competitions.fails((c) => c.update(owner, competitionId, { published: false }))).toBe(
      "CompetitionHasParticipants",
    );
  }));

test("a caller lists only their own entries: the session's and the guest token's, nobody else's", () =>
  rolledBack(async (tx) => {
    const { run, competitionId } = await setup(tx);
    const user = await createUser(tx, "Grace");
    const mine = await run((p) => p.enter(user, competitionId, {}));
    const theirs = await run((p) => p.enter(null, competitionId, { name: "Ada", email: "ada@example.com" }));
    await run((p) => p.enter(null, competitionId, { name: "Eve", email: "eve@example.com" }));
    expect(await run((p) => p.listOwn(signedIn(user), competitionId))).toEqual([mine.participant]);
    const both = await run((p) => p.listOwn({ user, guestToken: theirs.guest_token }, competitionId));
    expect(both.map((e) => e.id).sort()).toEqual([mine.participant.id, theirs.participant.id].sort());
    expect(await run((p) => p.listOwn(guest(null), competitionId))).toEqual([]);
    expect(await run((p) => p.listOwn(signedIn(user), crypto.randomUUID()))).toEqual([]);
  }));

test("signing in claims the guest entries with the user's verified email, in every competition", () =>
  rolledBack(async (tx) => {
    const [a, b] = [await setup(tx), await setup(tx)];
    const user = await createUser(tx, "Grace");
    const inA = await a.run((p) => p.enter(null, a.competitionId, { name: "G", email: user.email }));
    await b.run((p) => p.enter(null, b.competitionId, { name: "G", email: user.email.toUpperCase() }));
    await a.participants.run((p) => p.claimGuestEntries(user.id));
    expect(await a.run((p) => p.listOwn(signedIn(user)))).toMatchObject([{ name: "Grace" }, { name: "Grace" }]);
    expect(await a.run((p) => p.listOwn(guest(inA.guest_token)))).toEqual([]);
  }));

test("an account without a name keeps the guest's name when claiming, and enters under its email", () =>
  rolledBack(async (tx) => {
    const [a, b] = [await setup(tx), await setup(tx)];
    const user = await createUser(tx, "");
    await a.run((p) => p.enter(null, a.competitionId, { name: "Ada", email: user.email }));
    await a.participants.run((p) => p.claimGuestEntries(user.id));
    expect(await a.run((p) => p.listOwn(signedIn(user)))).toMatchObject([{ name: "Ada" }]);
    expect((await b.run((p) => p.enter(user, b.competitionId, {}))).participant.name).toBe(user.email.toLowerCase());
  }));

test("an unverified email claims nothing", () =>
  rolledBack(async (tx) => {
    const { run, participants, competitionId } = await setup(tx);
    const user = await createUser(tx, "Mallory", false);
    const entered = await run((p) => p.enter(null, competitionId, { name: "G", email: user.email }));
    await participants.run((p) => p.claimGuestEntries(user.id));
    expect(await run((p) => p.listOwn(signedIn(user)))).toEqual([]);
    expect(await run((p) => p.listOwn(guest(entered.guest_token)))).toHaveLength(1);
  }));

test("claiming skips a competition the user already entered under an earlier email", () =>
  rolledBack(async (tx) => {
    const { run, participants, competitionId } = await setup(tx);
    const user = await createUser(tx, "Grace");
    await run((p) => p.enter(user, competitionId, {}));
    const email = `new-${crypto.randomUUID()}@blikka.test`;
    await tx.update(model.user).set({ email }).where(eq(model.user.id, user.id));
    const entered = await run((p) => p.enter(null, competitionId, { name: "G", email }));
    await participants.run((p) => p.claimGuestEntries(user.id));
    expect(await run((p) => p.listOwn(signedIn(user), competitionId))).toHaveLength(1);
    expect(await run((p) => p.listOwn(guest(entered.guest_token)))).toHaveLength(1);
  }));
