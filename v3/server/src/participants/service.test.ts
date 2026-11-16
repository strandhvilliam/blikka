import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { CompetitionsService } from "../competitions/service.ts";
import * as model from "../db/model.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import { EntryService } from "../entry/service.ts";
import { SubmissionsService } from "../submissions/service.ts";
import { ParticipantsService } from "./service.ts";

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const organizationId = await createOrganization(tx, owner);
  const competitions = runner(tx, CompetitionsService, CompetitionsService.layer);

  const { id: competitionId } = await competitions.run((c) =>
    c.create(owner, organizationId, `Marathon ${crypto.randomUUID()}`),
  );

  await tx.insert(model.topics).values({ competitionId, name: "Open", position: 1 });
  await competitions.run((c) => c.update(owner, competitionId, { published: true }));
  const entering = runner(tx, EntryService, EntryService.layer);

  return { ...runner(tx, ParticipantsService, ParticipantsService.layer), entering, owner, competitionId };
};

test("organizers list their competitions' entries; outsiders get none", () =>
  rolledBack(async (tx) => {
    const { run, entering, owner, competitionId } = await setup(tx);
    await entering.run((e) => e.enter(null, competitionId, { name: "Ada", email: "ada@example.com" }));
    const [entry] = await run((p) => p.list(owner, competitionId));
    expect(entry).toMatchObject({ name: "Ada", signed_in: false });
    const stranger = await createUser(tx, "Stranger");
    expect(await run((p) => p.list(stranger, competitionId))).toEqual([]);
    // The token hash never leaves the service.
    const [row] = await tx.select().from(model.participants).where(eq(model.participants.competitionId, competitionId));
    expect(row!.guestTokenHash).toHaveLength(64);
    expect(entry).not.toHaveProperty("guestTokenHash");
  }));

test("organizers see what each entry submitted, and a deleted entry is gone for everyone until it enters again", () =>
  rolledBack(async (tx) => {
    const { run, fails, entering, owner, competitionId } = await setup(tx);
    const competitions = runner(tx, CompetitionsService, CompetitionsService.layer);
    const submissions = runner(tx, SubmissionsService, SubmissionsService.layer);
    await competitions.run((c) => c.update(owner, competitionId, { opens_at: new Date(Date.now() - 1000) }));
    const ada = await entering.run((e) => e.enter(null, competitionId, { name: "Ada", email: "ada@example.com" }));
    const asAda = { user: null, guestToken: ada.guest_token };
    const [topic] = await entering.run((e) => e.listTopics(asAda, ada.participant.id));
    await entering.run((e) => e.submit(asAda, ada.participant.id, topic!.id));

    expect(await run((p) => p.get(owner, ada.participant.id))).toMatchObject({ name: "Ada", submissions: 1 });
    expect(await submissions.run((s) => s.list(owner, ada.participant.id))).toMatchObject([{ topic_id: topic!.id }]);

    const stranger = await createUser(tx, "Stranger");
    expect(await fails((p) => p.get(stranger, ada.participant.id))).toBe("ParticipantNotFound");
    expect(await fails((p) => p.remove(stranger, ada.participant.id))).toBe("ParticipantNotFound");
    expect(await submissions.run((s) => s.list(stranger, ada.participant.id))).toEqual([]);

    await run((p) => p.remove(owner, ada.participant.id));
    expect(await run((p) => p.list(owner, competitionId))).toEqual([]);
    expect(await fails((p) => p.get(owner, ada.participant.id))).toBe("ParticipantNotFound");
    expect(await submissions.run((s) => s.list(owner, ada.participant.id))).toEqual([]);
    expect(await entering.fails((e) => e.requireParticipantOwner(asAda, ada.participant.id))).toBe(
      "ParticipantNotFound",
    );

    const again = await entering.run((e) => e.enter(null, competitionId, { name: "Ada", email: "ada@example.com" }));
    expect(again.participant.id).not.toBe(ada.participant.id);
    expect(await run((p) => p.get(owner, again.participant.id))).toMatchObject({ submissions: 0 });
  }));

test("a signed-in user whose entry was deleted gets a new one, and signing in claims nothing deleted", () =>
  rolledBack(async (tx) => {
    const { run, entering, owner, competitionId } = await setup(tx);
    const user = await createUser(tx, "Grace");
    const first = await entering.run((e) => e.enter(user, competitionId, {}));
    await run((p) => p.remove(owner, first.participant.id));
    const second = await entering.run((e) => e.enter(user, competitionId, {}));
    expect(second.participant.id).not.toBe(first.participant.id);

    const guest = await entering.run((e) => e.enter(null, competitionId, { name: "Ada", email: "ada@example.com" }));
    await run((p) => p.remove(owner, guest.participant.id));
    const ada = await createUser(tx, "Ada");
    await tx.update(model.user).set({ email: "ada@example.com" }).where(eq(model.user.id, ada.id));
    await run((p) => p.claimGuestEntries(ada.id));
    const [row] = await tx.select().from(model.participants).where(eq(model.participants.id, guest.participant.id));
    expect(row!.userId).toBeNull();
  }));
