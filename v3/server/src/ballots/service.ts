import { and, count, eq, inArray, isNotNull, isNull, ne, or, type SQL, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { BallotCaller } from "../auth/BallotSession.ts";
import { hashToken } from "../auth/tokens.ts";
import { Db, transaction, type Tx } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { rulesOf } from "../rounds/service.ts";
import { checkVote } from "./checkVote.ts";
import {
  type Ballot,
  BallotNotFound,
  BallotSubmitted,
  EntryNotFound,
  RoundNotOpen,
  type VoteInput,
  VoteInvalid,
  VoteLimitReached,
} from "./schemas.ts";

const {
  judgingRounds: rounds,
  judgingEntries: entries,
  judgingVoters: voters,
  judgingVotes: votes,
  participants,
  submissions,
} = model;

const columns = {
  id: voters.id,
  participantId: voters.participantId,
  roundId: rounds.id,
  roundName: rounds.name,
  method: rounds.method,
  maxVotes: rounds.maxVotes,
  favorite: rounds.favorite,
  scale: rounds.scale,
  opensAt: rounds.opensAt,
  closesAt: rounds.closesAt,
  competitionId: model.competitions.id,
  competitionName: model.competitions.name,
  timeZone: model.competitions.timeZone,
  votes: sql<number>`(select count(*)::int from ${votes} where ${votes}.voter_id = ${voters}.id)`,
  submittedAt: voters.submittedAt,
};

type Row = {
  id: string;
  participantId: string | null;
  roundId: string;
  roundName: string;
  method: "pick" | "rating";
  maxVotes: number | null;
  favorite: boolean;
  scale: number | null;
  opensAt: Date | null;
  closesAt: Date | null;
  competitionId: string;
  competitionName: string;
  timeZone: string;
  votes: number;
  submittedAt: Date | null;
};

const toBallot = (row: Row): Ballot => ({
  id: row.id,
  round_id: row.roundId,
  round_name: row.roundName,
  rules: rulesOf(row),
  opens_at: row.opensAt,
  closes_at: row.closesAt,
  competition_id: row.competitionId,
  competition_name: row.competitionName,
  time_zone: row.timeZone,
  votes: row.votes,
  submitted_at: row.submittedAt,
});

const voteColumns = {
  submission_id: votes.submissionId,
  value: votes.value,
  favorite: votes.favorite,
  note: votes.note,
};

const isOpen = sql`${rounds.opensAt} <= now() and (${rounds.closesAt} is null or ${rounds.closesAt} > now())`;

export class BallotsService extends Context.Service<BallotsService>()("blikka/ballots/BallotsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;

    const ownedParticipants = Effect.fn("BallotsService.ownedParticipants")(function* (
      caller: BallotCaller["Service"],
    ) {
      const owners: Array<SQL> = [];

      if (caller.user) {
        owners.push(eq(participants.userId, caller.user.id));
      }

      const { guestToken } = caller;

      if (guestToken) {
        const tokenHash = yield* Effect.promise(() => hashToken(guestToken));
        owners.push(eq(participants.guestTokenHash, tokenHash));
      }

      if (owners.length === 0) {
        return null;
      }

      return and(isNull(participants.deletedAt), or(...owners));
    });

    const owned = Effect.fn("BallotsService.owned")(function* (caller: BallotCaller["Service"]) {
      const owners: Array<SQL> = [];

      const { jurorToken } = caller;

      if (jurorToken) {
        const tokenHash = yield* Effect.promise(() => hashToken(jurorToken));
        owners.push(eq(voters.tokenHash, tokenHash));
      }

      const participantScope = yield* ownedParticipants(caller);

      if (participantScope) {
        owners.push(
          inArray(voters.participantId, db.select({ id: participants.id }).from(participants).where(participantScope)),
        );
      }

      if (owners.length === 0) {
        return sql`false`;
      }

      return and(
        isNull(voters.revokedAt),
        isNull(rounds.deletedAt),
        isNotNull(rounds.opensAt),
        isNull(model.competitions.deletedAt),
        or(...owners),
      );
    });

    const select = () =>
      db
        .select(columns)
        .from(voters)
        .innerJoin(rounds, eq(rounds.id, voters.roundId))
        .innerJoin(model.competitions, eq(model.competitions.id, rounds.competitionId));

    const joinOpenParticipantRounds = Effect.fn("BallotsService.joinOpenParticipantRounds")(function* (
      caller: BallotCaller["Service"],
    ) {
      const participantScope = yield* ownedParticipants(caller);

      if (!participantScope) {
        return;
      }

      yield* Effect.promise(() =>
        db
          .insert(voters)
          .select(
            db
              .select({
                id: sql<string>`uuidv7()`.as("id"),
                roundId: sql<string>`${rounds.id}`.as("round_id"),
                participantId: sql<string>`${participants.id}`.as("participant_id"),
                name: sql<string>`${participants.name}`.as("name"),
                email: sql<string>`${participants.email}`.as("email"),
                tokenHash: sql<null>`null`.as("token_hash"),
                submittedAt: sql<null>`null`.as("submitted_at"),
                revokedAt: sql<null>`null`.as("revoked_at"),
                createdAt: sql<Date>`now()`.as("created_at"),
              })
              .from(participants)
              .innerJoin(rounds, eq(rounds.competitionId, participants.competitionId))
              .where(and(participantScope, eq(rounds.voters, "participants"), isNull(rounds.deletedAt), isOpen)),
          )
          .onConflictDoNothing(),
      );
    });

    const list = Effect.fn("BallotsService.list")(function* (caller: BallotCaller["Service"], competitionId?: string) {
      yield* joinOpenParticipantRounds(caller);

      const filters = [yield* owned(caller)];

      if (competitionId) {
        filters.push(eq(rounds.competitionId, competitionId));
      }

      const rows = yield* Effect.promise(() =>
        select()
          .where(and(...filters))
          .orderBy(rounds.opensAt, voters.id),
      );

      return rows.map(toBallot);
    });

    const find = Effect.fn("BallotsService.find")(function* (caller: BallotCaller["Service"], id: string) {
      const scope = yield* owned(caller);
      const [row] = yield* Effect.promise(() => select().where(and(scope, eq(voters.id, id))));

      if (!row) {
        return yield* new BallotNotFound();
      }

      return row;
    });

    const entriesOf = (row: Row) =>
      Effect.gen(function* () {
        const all = yield* Effect.promise(() =>
          db
            .select({
              submission_id: entries.submissionId,
              participant_id: submissions.participantId,
              topic_name: model.topics.name,
              topic_position: model.topics.position,
            })
            .from(entries)
            .innerJoin(submissions, eq(submissions.id, entries.submissionId))
            .innerJoin(participants, eq(participants.id, submissions.participantId))
            .innerJoin(model.topics, eq(model.topics.id, submissions.topicId))
            .where(and(eq(entries.roundId, row.roundId), isNull(participants.deletedAt)))
            .orderBy(model.topics.position, entries.submissionId),
        );

        return all
          .map((entry, index) => ({ ...entry, number: index + 1 }))
          .filter((entry) => entry.participant_id !== row.participantId)
          .map(({ participant_id: _, ...entry }) => entry);
      });

    const get = Effect.fn("BallotsService.get")(function* (caller: BallotCaller["Service"], id: string) {
      const row = yield* find(caller, id);
      const ballotEntries = yield* entriesOf(row);

      const cast = yield* Effect.promise(() =>
        db.select(voteColumns).from(votes).where(eq(votes.voterId, id)).orderBy(votes.submissionId),
      );

      return { ballot: toBallot(row), entries: ballotEntries, votes: cast };
    });

    const lockOpen = (tx: Tx, row: Row) =>
      Effect.gen(function* () {
        const [voter] = yield* Effect.promise(() =>
          tx.select({ submittedAt: voters.submittedAt }).from(voters).where(eq(voters.id, row.id)).for("update"),
        );

        const [round] = yield* Effect.promise(() =>
          tx
            .select({ id: rounds.id })
            .from(rounds)
            .where(and(eq(rounds.id, row.roundId), isOpen)),
        );

        if (!round) {
          return yield* new RoundNotOpen();
        }

        if (voter?.submittedAt) {
          return yield* new BallotSubmitted();
        }
      });

    const vote = Effect.fn("BallotsService.vote")(function* (
      caller: BallotCaller["Service"],
      id: string,
      submissionId: string,
      input: VoteInput,
    ) {
      const row = yield* find(caller, id);
      const rules = rulesOf(row);
      const checked = checkVote(rules, input);

      if (!checked) {
        return yield* new VoteInvalid();
      }

      return yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          yield* lockOpen(tx, row);

          const eligible = [
            eq(entries.roundId, row.roundId),
            eq(entries.submissionId, submissionId),
            isNull(participants.deletedAt),
          ];

          if (row.participantId) {
            eligible.push(ne(submissions.participantId, row.participantId));
          }

          const [entry] = yield* Effect.promise(() =>
            tx
              .select({ submissionId: entries.submissionId })
              .from(entries)
              .innerJoin(submissions, eq(submissions.id, entries.submissionId))
              .innerJoin(participants, eq(participants.id, submissions.participantId))
              .where(and(...eligible)),
          );

          if (!entry) {
            return yield* new EntryNotFound();
          }

          const [existing] = yield* Effect.promise(() =>
            tx
              .select(voteColumns)
              .from(votes)
              .where(and(eq(votes.voterId, id), eq(votes.submissionId, submissionId))),
          );

          if (!existing && rules.method === "pick") {
            if (rules.max_votes === 1) {
              yield* Effect.promise(() => tx.delete(votes).where(eq(votes.voterId, id)));
            } else {
              const [cast] = yield* Effect.promise(() =>
                tx.select({ n: count() }).from(votes).where(eq(votes.voterId, id)),
              );

              if (cast!.n >= rules.max_votes) {
                return yield* new VoteLimitReached();
              }
            }
          }

          const favorite = checked.favorite ?? existing?.favorite ?? false;
          const note = input.note === undefined ? (existing?.note ?? null) : input.note || null;

          if (favorite) {
            yield* Effect.promise(() =>
              tx
                .update(votes)
                .set({ favorite: false })
                .where(and(eq(votes.voterId, id), eq(votes.favorite, true), ne(votes.submissionId, submissionId))),
            );
          }

          const [saved] = yield* Effect.promise(() =>
            tx
              .insert(votes)
              .values({ voterId: id, submissionId, value: checked.value, favorite, note })
              .onConflictDoUpdate({
                target: [votes.voterId, votes.submissionId],
                set: { value: checked.value, favorite, note, updatedAt: sql`now()` },
              })
              .returning(voteColumns),
          );

          return saved!;
        }),
      );
    });

    const unvote = Effect.fn("BallotsService.unvote")(function* (
      caller: BallotCaller["Service"],
      id: string,
      submissionId: string,
    ) {
      const row = yield* find(caller, id);

      yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          yield* lockOpen(tx, row);
          yield* Effect.promise(() =>
            tx.delete(votes).where(and(eq(votes.voterId, id), eq(votes.submissionId, submissionId))),
          );
        }),
      );
    });

    const submit = Effect.fn("BallotsService.submit")(function* (caller: BallotCaller["Service"], id: string) {
      const row = yield* find(caller, id);

      yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          yield* lockOpen(tx, row);
          yield* Effect.promise(() =>
            tx
              .update(voters)
              .set({ submittedAt: sql`now()` })
              .where(eq(voters.id, id)),
          );
        }),
      );

      return toBallot(yield* find(caller, id));
    });

    return { list, get, vote, unvote, submit };
  }),
}) {
  static readonly layer = Layer.effect(BallotsService, BallotsService.make);
}
