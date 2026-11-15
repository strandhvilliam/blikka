import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { CompetitionsService } from "../competitions/service.ts";
import * as model from "../db/model.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import { EntryService } from "../entry/service.ts";
import { ParticipantsService } from "./service.ts";

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const organizationId = await createOrganization(tx, owner);
  const competitions = runner(tx, CompetitionsService, CompetitionsService.layer);
  const { id: competitionId } = await competitions.run((c) => c.create(owner, organizationId, `Marathon ${crypto.randomUUID()}`));
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
