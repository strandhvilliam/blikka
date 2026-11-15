import { expect, test } from "bun:test";
import * as model from "../db/model.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import { CompetitionsService } from "./service.ts";

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const organizationId = await createOrganization(tx, owner);
  const s = runner(tx, CompetitionsService, CompetitionsService.layer);
  const { id } = await s.run((c) => c.create(owner, organizationId, `Marathon ${crypto.randomUUID()}`));
  return { ...s, owner, id };
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
    });
  }));

test("update changes only the fields sent, and the slug stays", () =>
  rolledBack(async (tx) => {
    const { run, owner, id } = await setup(tx);
    const before = await run((s) => s.get(owner, id));
    const opens_at = new Date("2026-12-01T08:00:00Z");
    const after = await run((s) => s.update(owner, id, { name: "Renamed", opens_at }));
    expect(after).toMatchObject({ name: "Renamed", slug: before.slug, description: "", opens_at });
    expect(await run((s) => s.update(owner, id, { description: "Shoot the city" }))).toMatchObject({ name: "Renamed", opens_at });
  }));

test("closing before opening is refused, also against the stored bound", () =>
  rolledBack(async (tx) => {
    const { run, fails, owner, id } = await setup(tx);
    await run((s) => s.update(owner, id, { opens_at: new Date("2026-12-01T08:00:00Z") }));
    expect(await fails((s) => s.update(owner, id, { closes_at: new Date("2026-12-01T08:00:00Z") }))).toBe("CompetitionWindowInvalid");
    expect(await run((s) => s.update(owner, id, { opens_at: null, closes_at: new Date() }))).toMatchObject({ opens_at: null });
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
