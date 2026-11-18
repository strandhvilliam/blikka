import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { GUEST_TOKEN_PREFIX } from "../auth/EntrySession.ts";
import { hashToken, newToken } from "../auth/tokens.ts";
import { BallotsService } from "../ballots/service.ts";
import { CompetitionsService } from "../competitions/service.ts";
import { createOrganization, createUser, rolledBack, runner, type Tx } from "../db/testDb.ts";
import * as model from "../db/model.ts";
import { TopicsService } from "../topics/service.ts";
import { VotersService } from "../voters/service.ts";
import type { RoundCreate } from "./schemas.ts";
import { RoundsService } from "./service.ts";

const setup = async (tx: Tx) => {
  const owner = await createUser(tx, "Owner");
  const organizationId = await createOrganization(tx, owner);
  const competitions = runner(tx, CompetitionsService, CompetitionsService.layer);

  const { id: competitionId } = await competitions.run((c) =>
    c.create(owner, {
      organization_id: organizationId,
      name: `Marathon ${crypto.randomUUID()}`,
      time_zone: "Europe/Stockholm",
    }),
  );

  const topics = runner(tx, TopicsService, TopicsService.layer);
  const light = await topics.run((t) => t.create(owner, competitionId, "Light"));
  const shadow = await topics.run((t) => t.create(owner, competitionId, "Shadow"));

  const enter = async (name: string) => {
    const token = newToken(GUEST_TOKEN_PREFIX);

    const [participant] = await tx
      .insert(model.participants)
      .values({
        competitionId,
        name,
        email: `${name}-${crypto.randomUUID()}@blikka.test`,
        guestTokenHash: await hashToken(token),
      })
      .returning();

    return { ...participant!, caller: { user: null, guestToken: token, jurorToken: null } };
  };

  const submit = async (participantId: string, topicId: string) => {
    const [submission] = await tx.insert(model.submissions).values({ participantId, topicId }).returning();

    return submission!.id;
  };

  const rounds = runner(tx, RoundsService, RoundsService.layer);
  const voters = runner(tx, VotersService, VotersService.layer);
  const ballots = runner(tx, BallotsService, BallotsService.layer);

  const create = (input: Omit<RoundCreate, "competition_id">) =>
    rounds.run((r) => r.create(owner, { competition_id: competitionId, ...input }));

  const juror = async (roundId: string, name: string) => {
    const { voter, token } = await voters.run((v) =>
      v.invite(owner, { round_id: roundId, name, email: `${name}@blikka.test` }),
    );

    return { voter, caller: { user: null, guestToken: null, jurorToken: token } };
  };

  const close = (roundId: string) =>
    tx
      .update(model.judgingRounds)
      .set({ opensAt: sql`now() - interval '2 hours'`, closesAt: sql`now() - interval '1 hour'` })
      .where(eq(model.judgingRounds.id, roundId));

  const ballotOf = async (caller: { user: null; guestToken: string | null; jurorToken: string | null }) => {
    const [ballot] = await ballots.run((b) => b.list(caller, competitionId));

    return ballot!;
  };

  return {
    owner,
    competitionId,
    light,
    shadow,
    enter,
    submit,
    rounds,
    voters,
    ballots,
    create,
    juror,
    close,
    ballotOf,
  };
};

const peerVote = { method: "pick", max_votes: 1, favorite: false } as const;
const stars = { method: "rating", scale: 5 } as const;

test("opening a round copies its topic's photos once, and a round without photos can't open", () =>
  rolledBack(async (tx) => {
    const { owner, light, shadow, enter, submit, rounds, create } = await setup(tx);
    const round = await create({ name: "Light vote", rules: peerVote, voters: "participants", topic_id: light.id });

    expect(await rounds.fails((r) => r.open(owner, round.id, null))).toBe("RoundHasNoEntries");

    const [ada, bo] = [await enter("Ada"), await enter("Bo")];
    await submit(ada.id, light.id);
    await submit(bo.id, light.id);
    await submit(bo.id, shadow.id);

    const opened = await rounds.run((r) => r.open(owner, round.id, null));
    expect(opened.entries).toBe(2);
    expect(opened.opens_at).not.toBeNull();

    await submit((await enter("Cy")).id, light.id);
    expect((await rounds.run((r) => r.get(owner, round.id))).entries).toBe(2);
    expect(await rounds.fails((r) => r.open(owner, round.id, null))).toBe("RoundStarted");
  }));

test("a participant votes on everyone else's photos, and a new pick replaces the old one", () =>
  rolledBack(async (tx) => {
    const { owner, light, enter, submit, rounds, ballots, create, ballotOf } = await setup(tx);
    const [ada, bo, cy] = [await enter("Ada"), await enter("Bo"), await enter("Cy")];
    const own = await submit(ada.id, light.id);
    const bos = await submit(bo.id, light.id);
    const cys = await submit(cy.id, light.id);
    const round = await create({ name: "Peer vote", rules: peerVote, voters: "participants" });
    await rounds.run((r) => r.open(owner, round.id, null));

    const ballot = await ballotOf(ada.caller);
    const { entries } = await ballots.run((b) => b.get(ada.caller, ballot.id));
    expect(entries.map((entry) => entry.submission_id).sort()).toEqual([bos, cys].sort());

    expect(await ballots.fails((b) => b.vote(ada.caller, ballot.id, own, {}))).toBe("EntryNotFound");

    await ballots.run((b) => b.vote(ada.caller, ballot.id, bos, {}));
    await ballots.run((b) => b.vote(ada.caller, ballot.id, cys, {}));

    const { votes } = await ballots.run((b) => b.get(ada.caller, ballot.id));
    expect(votes.map((vote) => vote.submission_id)).toEqual([cys]);

    const results = await rounds.run((r) => r.results(owner, round.id));
    expect(results.find((result) => result.rank === 1)?.submission_id).toBe(cys);
    expect((await rounds.run((r) => r.get(owner, round.id))).voted).toBe(1);
  }));

test("a voter can't pick more than max_votes, and marking a favorite moves it", () =>
  rolledBack(async (tx) => {
    const { owner, light, enter, submit, rounds, ballots, create, juror, ballotOf } = await setup(tx);
    const a = await submit((await enter("Ada")).id, light.id);
    const b = await submit((await enter("Bo")).id, light.id);
    const c = await submit((await enter("Cy")).id, light.id);
    const shortlist = { method: "pick", max_votes: 2, favorite: true } as const;
    const round = await create({ name: "Shortlist", rules: shortlist, voters: "jury" });
    await rounds.run((r) => r.open(owner, round.id, null));
    const { caller } = await juror(round.id, "Dee");
    const ballot = await ballotOf(caller);

    await ballots.run((x) => x.vote(caller, ballot.id, a, {}));
    await ballots.run((x) => x.vote(caller, ballot.id, b, {}));
    expect(await ballots.fails((x) => x.vote(caller, ballot.id, c, {}))).toBe("VoteLimitReached");

    await ballots.run((x) => x.vote(caller, ballot.id, a, { favorite: true }));
    await ballots.run((x) => x.vote(caller, ballot.id, b, { favorite: true }));

    const { votes } = await ballots.run((x) => x.get(caller, ballot.id));
    expect(votes.filter((vote) => vote.favorite).map((vote) => vote.submission_id)).toEqual([b]);

    const results = await rounds.run((r) => r.results(owner, round.id));
    expect(results.find((result) => result.rank === 1)?.submission_id).toBe(b);
  }));

test("ratings stay within the scale, and results rank by average", () =>
  rolledBack(async (tx) => {
    const { owner, light, enter, submit, rounds, ballots, create, juror, ballotOf } = await setup(tx);
    const a = await submit((await enter("Ada")).id, light.id);
    const b = await submit((await enter("Bo")).id, light.id);
    const round = await create({ name: "Jury", rules: stars, voters: "jury" });
    await rounds.run((r) => r.open(owner, round.id, null));
    const dee = await juror(round.id, "Dee");
    const eli = await juror(round.id, "Eli");
    const deeBallot = await ballotOf(dee.caller);
    const eliBallot = await ballotOf(eli.caller);

    expect(await ballots.fails((x) => x.vote(dee.caller, deeBallot.id, a, { value: 6 }))).toBe("VoteInvalid");

    await ballots.run((x) => x.vote(dee.caller, deeBallot.id, a, { value: 3 }));
    await ballots.run((x) => x.vote(eli.caller, eliBallot.id, a, { value: 4 }));
    await ballots.run((x) => x.vote(dee.caller, deeBallot.id, b, { value: 5 }));

    const results = await rounds.run((r) => r.results(owner, round.id));
    expect(results.map((result) => [result.submission_id, result.average, result.votes, result.rank])).toEqual([
      [b, 5, 1, 1],
      [a, 3.5, 2, 2],
    ]);
  }));

test("a removed juror loses their ballot and their votes stop counting", () =>
  rolledBack(async (tx) => {
    const { owner, light, enter, submit, rounds, voters, ballots, create, juror, ballotOf } = await setup(tx);
    const a = await submit((await enter("Ada")).id, light.id);
    const round = await create({ name: "Jury", rules: stars, voters: "jury" });
    await rounds.run((r) => r.open(owner, round.id, null));
    const dee = await juror(round.id, "Dee");
    const ballot = await ballotOf(dee.caller);
    await ballots.run((x) => x.vote(dee.caller, ballot.id, a, { value: 4 }));

    expect(
      await voters.fails((v) => v.invite(owner, { round_id: round.id, name: "Dee", email: "dee@blikka.test" })),
    ).toBe("VoterAlreadyInvited");

    await voters.run((v) => v.revoke(owner, dee.voter.id));

    expect(await ballots.run((x) => x.list(dee.caller))).toEqual([]);
    expect(await ballots.fails((x) => x.get(dee.caller, ballot.id))).toBe("BallotNotFound");
    expect((await rounds.run((r) => r.results(owner, round.id)))[0]?.votes).toBe(0);
  }));

test("a closed round takes no votes, and a tiebreak round takes chosen entries from it", () =>
  rolledBack(async (tx) => {
    const { owner, light, enter, submit, rounds, ballots, create, close, ballotOf } = await setup(tx);
    const ada = await enter("Ada");
    const a = await submit(ada.id, light.id);
    const b = await submit((await enter("Bo")).id, light.id);
    const c = await submit((await enter("Cy")).id, light.id);
    const round = await create({ name: "Peer vote", rules: peerVote, voters: "participants" });
    await rounds.run((r) => r.open(owner, round.id, null));
    const ballot = await ballotOf(ada.caller);

    const tiebreak = { name: "Tiebreak", rules: peerVote, voters: "participants", source_round_id: round.id } as const;

    expect(
      await rounds.fails((r) =>
        r.create(owner, { competition_id: round.competition_id, ...tiebreak, submission_ids: [b, c] }),
      ),
    ).toBe("SourceRoundNotClosed");

    await close(round.id);

    expect(await ballots.fails((x) => x.vote(ada.caller, ballot.id, b, {}))).toBe("RoundNotOpen");

    const created = await create({ ...tiebreak, submission_ids: [b, c] });
    expect(created.entries).toBe(2);
    expect(
      await rounds.fails((r) =>
        r.create(owner, {
          competition_id: round.competition_id,
          ...tiebreak,
          submission_ids: [a, crypto.randomUUID()],
        }),
      ),
    ).toBe("RoundEntriesInvalid");
  }));

test("outsiders see no rounds and can't create, open or invite", () =>
  rolledBack(async (tx) => {
    const { competitionId, rounds, voters, create } = await setup(tx);
    const round = await create({ name: "Jury", rules: stars, voters: "jury" });
    const stranger = await createUser(tx, "Stranger");

    expect(await rounds.run((r) => r.list(stranger, competitionId))).toEqual([]);
    expect(await rounds.fails((r) => r.get(stranger, round.id))).toBe("RoundNotFound");
    expect(await rounds.fails((r) => r.open(stranger, round.id, null))).toBe("RoundNotFound");
    expect(
      await rounds.fails((r) =>
        r.create(stranger, { competition_id: competitionId, name: "Mine", rules: stars, voters: "jury" }),
      ),
    ).toBe("CompetitionNotFound");
    expect(
      await voters.fails((v) => v.invite(stranger, { round_id: round.id, name: "Eve", email: "eve@blikka.test" })),
    ).toBe("RoundNotFound");
  }));
