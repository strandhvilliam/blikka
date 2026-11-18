import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CompetitionNotFound } from "../competitions/schemas.ts";
import type { User } from "../contract.ts";
import { Db, transaction } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";
import { TopicNotFound } from "../topics/schemas.ts";
import { rank } from "./rank.ts";
import {
  type Round,
  type RoundCreate,
  RoundEntriesInvalid,
  RoundHasNoEntries,
  RoundNotFound,
  type RoundRules,
  RoundStarted,
  type RoundUpdate,
  RoundWindowInvalid,
  SourceRoundNotClosed,
} from "./schemas.ts";

const { judgingRounds: rounds, judgingEntries: entries, judgingVoters: voters, judgingVotes: votes } = model;

const columns = {
  id: rounds.id,
  competitionId: rounds.competitionId,
  organizationId: model.competitions.organizationId,
  name: rounds.name,
  method: rounds.method,
  maxVotes: rounds.maxVotes,
  favorite: rounds.favorite,
  scale: rounds.scale,
  voters: rounds.voters,
  topicId: rounds.topicId,
  sourceRoundId: rounds.sourceRoundId,
  opensAt: rounds.opensAt,
  closesAt: rounds.closesAt,
  entries: sql<number>`(select count(*)::int from ${entries} where ${entries}.round_id = ${rounds}.id)`,
  voted: sql<number>`(
    select count(*)::int from ${voters}
    where ${voters}.round_id = ${rounds}.id and ${voters}.revoked_at is null
    and exists (select 1 from ${votes} where ${votes}.voter_id = ${voters}.id)
    and (${voters}.participant_id is null or exists (
      select 1 from ${model.participants}
      where ${model.participants}.id = ${voters}.participant_id and ${model.participants}.deleted_at is null
    ))
  )`,
};

type Row = {
  id: string;
  competitionId: string;
  name: string;
  method: "pick" | "rating";
  maxVotes: number | null;
  favorite: boolean;
  scale: number | null;
  voters: "jury" | "participants";
  topicId: string | null;
  sourceRoundId: string | null;
  opensAt: Date | null;
  closesAt: Date | null;
  entries: number;
  voted: number;
};

export const rulesOf = (row: Pick<Row, "method" | "maxVotes" | "favorite" | "scale">): RoundRules =>
  row.method === "pick"
    ? { method: "pick", max_votes: row.maxVotes ?? 1, favorite: row.favorite }
    : { method: "rating", scale: row.scale === 10 ? 10 : 5 };

const toRound = (row: Row): Round => ({
  id: row.id,
  competition_id: row.competitionId,
  name: row.name,
  rules: rulesOf(row),
  voters: row.voters,
  topic_id: row.topicId,
  source_round_id: row.sourceRoundId,
  opens_at: row.opensAt,
  closes_at: row.closesAt,
  entries: row.entries,
  voted: row.voted,
});

const ruleColumns = (rules: RoundRules) =>
  rules.method === "pick"
    ? { method: "pick" as const, maxVotes: rules.max_votes, favorite: rules.favorite, scale: null }
    : { method: "rating" as const, maxVotes: null, favorite: false, scale: rules.scale };

const voterParticipant = alias(model.participants, "voter_participant");

export class RoundsService extends Context.Service<RoundsService>()("blikka/rounds/RoundsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { authorize, selectAccessibleOrganizationIds } = yield* PermissionsService;

    const readable = (caller: User) =>
      and(
        inArray(model.competitions.organizationId, selectAccessibleOrganizationIds(caller, "judging:read")),
        isNull(model.competitions.deletedAt),
        isNull(rounds.deletedAt),
      );

    const select = () =>
      db.select(columns).from(rounds).innerJoin(model.competitions, eq(model.competitions.id, rounds.competitionId));

    const list = Effect.fn("RoundsService.list")(function* (caller: User, competitionId?: string) {
      const filters = [readable(caller)];

      if (competitionId) {
        filters.push(eq(rounds.competitionId, competitionId));
      }

      const rows = yield* Effect.promise(() =>
        select()
          .where(and(...filters))
          .orderBy(rounds.competitionId, rounds.id),
      );

      return rows.map(toRound);
    });

    const find = Effect.fn("RoundsService.find")(function* (caller: User, id: string) {
      const [row] = yield* Effect.promise(() => select().where(and(readable(caller), eq(rounds.id, id))));

      if (!row) {
        return yield* new RoundNotFound();
      }

      return row;
    });

    const get = Effect.fn("RoundsService.get")(function* (caller: User, id: string) {
      return toRound(yield* find(caller, id));
    });

    const writable = Effect.fn("RoundsService.writable")(function* (caller: User, id: string) {
      const row = yield* find(caller, id);
      yield* authorize(caller, "judging:write", row.organizationId).pipe(
        Effect.catchTag("OrganizationNotFound", () => Effect.fail(new RoundNotFound())),
      );

      return row;
    });

    const create = Effect.fn("RoundsService.create")(function* (caller: User, input: RoundCreate) {
      const [competition] = yield* Effect.promise(() =>
        db
          .select({ organizationId: model.competitions.organizationId })
          .from(model.competitions)
          .where(and(eq(model.competitions.id, input.competition_id), isNull(model.competitions.deletedAt))),
      );

      if (!competition) {
        return yield* new CompetitionNotFound();
      }

      yield* authorize(caller, "judging:write", competition.organizationId).pipe(
        Effect.catchTag("OrganizationNotFound", () => Effect.fail(new CompetitionNotFound())),
      );

      const topicId = input.topic_id ?? null;
      const sourceRoundId = input.source_round_id ?? null;
      const submissionIds = input.submission_ids ?? [];

      if ((sourceRoundId === null) !== (submissionIds.length === 0) || (sourceRoundId && topicId)) {
        return yield* new RoundEntriesInvalid();
      }

      if (topicId) {
        const [topic] = yield* Effect.promise(() =>
          db
            .select({ id: model.topics.id })
            .from(model.topics)
            .where(
              and(
                eq(model.topics.id, topicId),
                eq(model.topics.competitionId, input.competition_id),
                isNull(model.topics.deletedAt),
              ),
            ),
        );

        if (!topic) {
          return yield* new TopicNotFound();
        }
      }

      return yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          if (sourceRoundId) {
            const [source] = yield* Effect.promise(() =>
              tx
                .select({ closed: sql<boolean>`coalesce(${rounds.closesAt} <= now(), false)` })
                .from(rounds)
                .where(
                  and(
                    eq(rounds.id, sourceRoundId),
                    eq(rounds.competitionId, input.competition_id),
                    isNull(rounds.deletedAt),
                  ),
                ),
            );

            if (!source) {
              return yield* new RoundNotFound();
            }

            if (!source.closed) {
              return yield* new SourceRoundNotClosed();
            }

            const unique = [...new Set(submissionIds)];

            const [inSource] = yield* Effect.promise(() =>
              tx
                .select({ n: count() })
                .from(entries)
                .where(and(eq(entries.roundId, sourceRoundId), inArray(entries.submissionId, unique))),
            );

            if (inSource!.n !== unique.length) {
              return yield* new RoundEntriesInvalid();
            }
          }

          const [created] = yield* Effect.promise(() =>
            tx
              .insert(rounds)
              .values({
                competitionId: input.competition_id,
                name: input.name,
                ...ruleColumns(input.rules),
                voters: input.voters,
                topicId,
                sourceRoundId,
              })
              .returning({ id: rounds.id }),
          );

          if (submissionIds.length > 0) {
            yield* Effect.promise(() =>
              tx
                .insert(entries)
                .values([...new Set(submissionIds)].map((submissionId) => ({ roundId: created!.id, submissionId }))),
            );
          }

          return created!.id;
        }),
      ).pipe(Effect.flatMap((id) => get(caller, id)));
    });

    const update = Effect.fn("RoundsService.update")(function* (caller: User, id: string, patch: RoundUpdate) {
      const current = yield* writable(caller, id);
      const closesAt = patch.closes_at;

      if (closesAt && (!current.opensAt || closesAt <= current.opensAt)) {
        return yield* new RoundWindowInvalid();
      }

      yield* Effect.promise(() =>
        db
          .update(rounds)
          .set({ name: patch.name, closesAt, updatedAt: sql`now()` })
          .where(eq(rounds.id, id)),
      );

      return yield* get(caller, id);
    });

    const open = Effect.fn("RoundsService.open")(function* (caller: User, id: string, closesAt: Date | null) {
      yield* writable(caller, id);

      if (closesAt && closesAt <= new Date()) {
        return yield* new RoundWindowInvalid();
      }

      yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          const [round] = yield* Effect.promise(() =>
            tx
              .select({
                competitionId: rounds.competitionId,
                topicId: rounds.topicId,
                sourceRoundId: rounds.sourceRoundId,
                opensAt: rounds.opensAt,
              })
              .from(rounds)
              .where(and(eq(rounds.id, id), isNull(rounds.deletedAt)))
              .for("update"),
          );

          if (!round) {
            return yield* new RoundNotFound();
          }

          if (round.opensAt) {
            return yield* new RoundStarted();
          }

          if (!round.sourceRoundId) {
            const pool = [
              eq(model.participants.competitionId, round.competitionId),
              isNull(model.participants.deletedAt),
              isNull(model.topics.deletedAt),
            ];

            if (round.topicId) {
              pool.push(eq(model.submissions.topicId, round.topicId));
            }

            yield* Effect.promise(() =>
              tx
                .insert(entries)
                .select(
                  tx
                    .select({ roundId: sql<string>`${id}::uuid`.as("round_id"), submissionId: model.submissions.id })
                    .from(model.submissions)
                    .innerJoin(model.participants, eq(model.participants.id, model.submissions.participantId))
                    .innerJoin(model.topics, eq(model.topics.id, model.submissions.topicId))
                    .where(and(...pool)),
                )
                .onConflictDoNothing(),
            );
          }

          const [pooled] = yield* Effect.promise(() =>
            tx.select({ n: count() }).from(entries).where(eq(entries.roundId, id)),
          );

          if (pooled!.n === 0) {
            return yield* new RoundHasNoEntries();
          }

          yield* Effect.promise(() =>
            tx
              .update(rounds)
              .set({ opensAt: sql`now()`, closesAt, updatedAt: sql`now()` })
              .where(eq(rounds.id, id)),
          );
        }),
      );

      return yield* get(caller, id);
    });

    const remove = Effect.fn("RoundsService.remove")(function* (caller: User, id: string) {
      yield* writable(caller, id);
      yield* Effect.promise(() =>
        db
          .update(rounds)
          .set({ deletedAt: sql`now()` })
          .where(eq(rounds.id, id)),
      );
    });

    const results = Effect.fn("RoundsService.results")(function* (caller: User, id: string) {
      const round = yield* find(caller, id);

      const tally = db
        .select({
          submissionId: votes.submissionId,
          votes: sql<number>`count(*)::int`.as("votes"),
          favorites: sql<number>`(count(*) filter (where ${votes.favorite}))::int`.as("favorites"),
          average: sql<number>`avg(${votes.value})::float8`.as("average"),
        })
        .from(votes)
        .innerJoin(voters, eq(voters.id, votes.voterId))
        .leftJoin(voterParticipant, eq(voterParticipant.id, voters.participantId))
        .where(
          and(
            eq(voters.roundId, id),
            isNull(voters.revokedAt),
            sql`(${voters.participantId} is null or ${voterParticipant.deletedAt} is null)`,
          ),
        )
        .groupBy(votes.submissionId)
        .as("tally");

      const rows = yield* Effect.promise(() =>
        db
          .select({
            submission_id: entries.submissionId,
            participant_id: model.participants.id,
            participant_name: model.participants.name,
            topic_id: model.topics.id,
            topic_name: model.topics.name,
            topic_position: model.topics.position,
            votes: sql<number>`coalesce(${tally.votes}, 0)`,
            favorites: sql<number>`coalesce(${tally.favorites}, 0)`,
            average: tally.average,
          })
          .from(entries)
          .innerJoin(model.submissions, eq(model.submissions.id, entries.submissionId))
          .innerJoin(model.participants, eq(model.participants.id, model.submissions.participantId))
          .innerJoin(model.topics, eq(model.topics.id, model.submissions.topicId))
          .leftJoin(tally, eq(tally.submissionId, entries.submissionId))
          .where(and(eq(entries.roundId, id), isNull(model.participants.deletedAt)))
          .orderBy(model.topics.position, entries.submissionId),
      );

      return rank(round.method, rows);
    });

    return { list, get, writable, create, update, open, remove, results };
  }),
}) {
  static readonly layer = Layer.effect(RoundsService, RoundsService.make);
}
