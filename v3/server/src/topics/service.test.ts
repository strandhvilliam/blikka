import { expect, test } from "bun:test";
import { CompetitionsService } from "../competitions/service.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import { EntryService } from "../entry/service.ts";
import { ParticipantsService } from "../participants/service.ts";
import { TopicsService } from "./service.ts";

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const organizationId = await createOrganization(tx, owner);
  const competitions = runner(tx, CompetitionsService, CompetitionsService.layer);

  const { id: competitionId } = await competitions.run((c) =>
    c.create(owner, {
      organization_id: organizationId,
      name: `Marathon ${crypto.randomUUID()}`,
      time_zone: "Europe/Stockholm",
      topics: [],
    }),
  );

  const s = runner(tx, TopicsService, TopicsService.layer);

  // One at a time: they share a transaction, and the order is the point.
  const add = async (...names: string[]) => {
    const added = [];

    for (const name of names) {
      added.push(await s.run((t) => t.create(owner, competitionId, name)));
    }

    return added;
  };

  const names = () =>
    s.run((t) => t.list(owner, competitionId)).then((list) => list.map((t) => `${t.position}:${t.name}`));

  return { ...s, competitions, owner, competitionId, add, names };
};

test("topics are added at the end and listed in order", () =>
  rolledBack(async (tx) => {
    const { add, names } = await setup(tx);
    await add("Light", "Shadow", "Water");
    expect(await names()).toEqual(["1:Light", "2:Shadow", "3:Water"]);
  }));

test("moving a topic shifts the ones between, and a position past the end means last", () =>
  rolledBack(async (tx) => {
    const { run, add, names, owner } = await setup(tx);
    const [light, , , wind] = await add("Light", "Shadow", "Water", "Wind");
    await run((t) => t.update(owner, wind!.id, { position: 1 }));
    expect(await names()).toEqual(["1:Wind", "2:Light", "3:Shadow", "4:Water"]);
    await run((t) => t.update(owner, light!.id, { position: 99, name: "Daylight" }));
    expect(await names()).toEqual(["1:Wind", "2:Shadow", "3:Water", "4:Daylight"]);
  }));

test("deleting a topic closes the gap", () =>
  rolledBack(async (tx) => {
    const { run, add, names, owner } = await setup(tx);
    const [, shadow] = await add("Light", "Shadow", "Water");
    await run((t) => t.remove(owner, shadow!.id));
    expect(await names()).toEqual(["1:Light", "2:Water"]);
  }));

test("a published competition keeps its last topic; a draft doesn't have to", () =>
  rolledBack(async (tx) => {
    const { run, fails, competitions, add, names, owner, competitionId } = await setup(tx);
    const [open] = await add("Open");
    await competitions.run((c) => c.update(owner, competitionId, { published: true }));
    expect(await fails((t) => t.remove(owner, open!.id))).toBe("LastTopic");
    await competitions.run((c) => c.update(owner, competitionId, { published: false }));
    await run((t) => t.remove(owner, open!.id));
    expect(await names()).toEqual([]);
  }));

test("outsiders see no topics and can't touch them", () =>
  rolledBack(async (tx) => {
    const { run, fails, add, competitionId } = await setup(tx);
    const [open] = await add("Open");
    const stranger = await createUser(tx, "Stranger");
    expect(await run((t) => t.list(stranger, competitionId))).toEqual([]);
    expect(await fails((t) => t.create(stranger, competitionId, "Mine"))).toBe("CompetitionNotFound");
    expect(await fails((t) => t.update(stranger, open!.id, { name: "Mine" }))).toBe("TopicNotFound");
    expect(await fails((t) => t.remove(stranger, open!.id))).toBe("TopicNotFound");
  }));

test("a topic with submissions can't be deleted, and once anyone has submitted the order is fixed", () =>
  rolledBack(async (tx) => {
    const { run, fails, add, names, competitions, owner, competitionId } = await setup(tx);
    const [light, shadow, water] = await add("Light", "Shadow", "Water");
    const opensAt = new Date(Date.now() - 1000);
    await competitions.run((c) => c.update(owner, competitionId, { published: true, opens_at: opensAt }));
    const entering = runner(tx, EntryService, EntryService.layer);
    const ada = await entering.run((e) => e.enter(null, competitionId, { name: "Ada", email: "ada@example.com" }));
    await entering.run((e) => e.submit({ user: null, guestToken: ada.guest_token }, ada.participant.id, light!.id));

    expect((await run((t) => t.list(owner, competitionId))).map((t) => t.submissions)).toEqual([1, 0, 0]);
    expect(await fails((t) => t.remove(owner, light!.id))).toBe("TopicHasSubmissions");
    expect(await fails((t) => t.update(owner, water!.id, { position: 1 }))).toBe("TopicOrderLocked");
    // Renaming, and a move to where it already is, change no numbers.
    await run((t) => t.update(owner, light!.id, { name: "Daylight", position: 1 }));
    await run((t) => t.remove(owner, water!.id));
    expect(await names()).toEqual(["1:Daylight", "2:Shadow"]);

    // A deleted entry's submissions stop counting.
    const participants = runner(tx, ParticipantsService, ParticipantsService.layer);
    await participants.run((p) => p.remove(owner, ada.participant.id));
    await run((t) => t.update(owner, shadow!.id, { position: 1 }));
    await run((t) => t.remove(owner, light!.id));
    expect(await names()).toEqual(["1:Shadow"]);
  }));
