import { expect, test } from "bun:test";
import * as model from "../db/model.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import { CompetitionsService } from "./service.ts";

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const organizationId = await createOrganization(tx, owner);
  const s = runner(tx, CompetitionsService, CompetitionsService.layer);

  const { id } = await s.run((c) =>
    c.create(owner, {
      organization_id: organizationId,
      name: `Marathon ${crypto.randomUUID()}`,
      time_zone: "Europe/Stockholm",
    }),
  );

  return { ...s, owner, organizationId, id };
};

test("a new competition is an unpublished draft with no window", () =>
  rolledBack(async (tx) => {
    const { run, owner, id } = await setup(tx);
    expect(await run((s) => s.get(owner, id))).toMatchObject({
      description: "",
      time_zone: "Europe/Stockholm",
      published_at: null,
      opens_at: null,
      closes_at: null,
      topics_in_sequence: false,
      minutes_per_topic: null,
    });
  }));

test("create takes the name and time zone; a taken name is refused", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, organizationId } = await setup(tx);

    const input = {
      organization_id: organizationId,
      name: `Walk ${crypto.randomUUID()}`,
      time_zone: "America/New_York",
    };

    expect(await run((s) => s.create(owner, input))).toMatchObject({ name: input.name, time_zone: "America/New_York" });
    expect(await fails((s) => s.create(owner, input))).toBe("CompetitionNameTaken");
  }));

test("update changes only the fields sent", () =>
  rolledBack(async (tx) => {
    const { run, owner, id } = await setup(tx);
    const opens_at = new Date("2026-12-01T08:00:00Z");
    const name = `Renamed ${crypto.randomUUID()}`;
    expect(await run((s) => s.update(owner, id, { name, opens_at }))).toMatchObject({
      name,
      description: "",
      opens_at,
    });
    expect(await run((s) => s.update(owner, id, { description: "Shoot the city" }))).toMatchObject({ name, opens_at });
  }));

test("renaming a draft moves its link unless the new one is taken; a published event keeps its link", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, organizationId, id } = await setup(tx);
    const suffix = crypto.randomUUID();
    const draft = await run((s) => s.update(owner, id, { name: `Draft ${suffix}` }));
    expect(draft.slug).toBe(`draft-${suffix}`);

    const other = { organization_id: organizationId, name: `Other ${suffix}`, time_zone: "Europe/Stockholm" };
    await run((s) => s.create(owner, other));
    expect(await fails((s) => s.update(owner, id, { name: `Other ${suffix}` }))).toBe("CompetitionNameTaken");

    await tx.insert(model.topics).values({ competitionId: id, name: "Open", position: 1 });
    await run((s) => s.update(owner, id, { published: true }));
    expect(await run((s) => s.update(owner, id, { name: `Published ${suffix}` }))).toMatchObject({
      name: `Published ${suffix}`,
      slug: `draft-${suffix}`,
    });
  }));

test("closing before opening is refused, also against the stored bound", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, id } = await setup(tx);
    await run((s) => s.update(owner, id, { opens_at: new Date("2026-12-01T08:00:00Z") }));
    expect(await fails((s) => s.update(owner, id, { closes_at: new Date("2026-12-01T08:00:00Z") }))).toBe(
      "CompetitionWindowInvalid",
    );
    expect(await run((s) => s.update(owner, id, { opens_at: null, closes_at: new Date() }))).toMatchObject({
      opens_at: null,
    });
  }));

test("a time limit needs topics in sequence, also against the stored settings", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, id } = await setup(tx);
    expect(await fails((s) => s.update(owner, id, { minutes_per_topic: 30 }))).toBe("TimeLimitNeedsSequence");
    expect(await run((s) => s.update(owner, id, { topics_in_sequence: true, minutes_per_topic: 30 }))).toMatchObject({
      topics_in_sequence: true,
      minutes_per_topic: 30,
    });
    expect(await fails((s) => s.update(owner, id, { topics_in_sequence: false }))).toBe("TimeLimitNeedsSequence");
    expect(await run((s) => s.update(owner, id, { topics_in_sequence: false, minutes_per_topic: null }))).toMatchObject(
      { topics_in_sequence: false, minutes_per_topic: null },
    );
  }));

test("publishing needs a topic, keeps the first published_at, and unpublishing clears it", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, id } = await setup(tx);
    expect(await fails((s) => s.update(owner, id, { published: true }))).toBe("CompetitionHasNoTopics");
    await tx.insert(model.topics).values({ competitionId: id, name: "Open", position: 1 });
    const { published_at } = await run((s) => s.update(owner, id, { published: true }));
    expect(published_at).toBeInstanceOf(Date);
    expect((await run((s) => s.update(owner, id, { published: true }))).published_at).toEqual(published_at);
    expect((await run((s) => s.update(owner, id, { published: false }))).published_at).toBeNull();
  }));

test("a deleted competition is gone, and outsiders can't touch one", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, id } = await setup(tx);
    const stranger = await createUser(tx, "Stranger");
    expect(await fails((s) => s.update(stranger, id, { name: "Mine" }))).toBe("CompetitionNotFound");
    expect(await fails((s) => s.remove(stranger, id))).toBe("CompetitionNotFound");
    await run((s) => s.remove(owner, id));
    expect(await fails((s) => s.get(owner, id))).toBe("CompetitionNotFound");
    expect(await fails((s) => s.update(owner, id, { name: "Back" }))).toBe("CompetitionNotFound");
  }));
