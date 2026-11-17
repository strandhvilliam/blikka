import { and, count, eq, gt, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CompetitionNotFound } from "../competitions/schemas.ts";
import { CompetitionsService } from "../competitions/service.ts";
import type { User } from "../contract.ts";
import { Db, transaction, type Tx } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { LastTopic, TopicHasSubmissions, TopicNotFound, TopicOrderLocked, type TopicUpdate } from "./schemas.ts";

const { topics } = model;

const columns = {
  id: topics.id,
  competition_id: topics.competitionId,
  name: topics.name,
  position: topics.position,
  submissions: sql<number>`(
    select count(*)::int from ${model.submissions}
    inner join ${model.participants} on ${model.participants}.id = ${model.submissions}.participant_id
    where ${model.submissions}.topic_id = ${topics}.id and ${model.participants}.deleted_at is null
  )`,
};

const liveIn = (competitionId: string) => and(eq(topics.competitionId, competitionId), isNull(topics.deletedAt));

const lockCompetition = (tx: Tx, id: string) =>
  Effect.gen(function* () {
    const [competition] = yield* Effect.promise(() =>
      tx
        .select({ publishedAt: model.competitions.publishedAt })
        .from(model.competitions)
        .where(and(eq(model.competitions.id, id), isNull(model.competitions.deletedAt)))
        .for("update"),
    );

    return competition;
  });

const countLive = (tx: Tx, competitionId: string) =>
  Effect.gen(function* () {
    const [row] = yield* Effect.promise(() => tx.select({ n: count() }).from(topics).where(liveIn(competitionId)));

    return row!.n;
  });

const liveTopic = (tx: Tx, id: string) =>
  Effect.gen(function* () {
    const [topic] = yield* Effect.promise(() =>
      tx
        .select(columns)
        .from(topics)
        .where(and(eq(topics.id, id), isNull(topics.deletedAt))),
    );

    return topic;
  });

export class TopicsService extends Context.Service<TopicsService>()("blikka/topics/TopicsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const competitions = yield* CompetitionsService;

    const readable = (caller: User) =>
      and(inArray(topics.competitionId, competitions.selectReadableIds(caller)), isNull(topics.deletedAt));

    const list = Effect.fn("TopicsService.list")(function* (caller: User, competitionId?: string) {
      const filters = [readable(caller)];

      if (competitionId) {
        filters.push(eq(topics.competitionId, competitionId));
      }

      return yield* Effect.promise(() =>
        db
          .select(columns)
          .from(topics)
          .where(and(...filters))
          .orderBy(topics.competitionId, topics.position),
      );
    });

    const get = Effect.fn("TopicsService.get")(function* (caller: User, id: string) {
      const [topic] = yield* Effect.promise(() =>
        db
          .select(columns)
          .from(topics)
          .where(and(readable(caller), eq(topics.id, id))),
      );

      if (!topic) {
        return yield* new TopicNotFound();
      }

      return topic;
    });

    const writable = Effect.fn("TopicsService.writable")(function* (caller: User, id: string) {
      const topic = yield* get(caller, id);
      yield* competitions
        .writable(caller, topic.competition_id)
        .pipe(Effect.catchTag("CompetitionNotFound", () => Effect.fail(new TopicNotFound())));

      return topic;
    });

    const create = Effect.fn("TopicsService.create")(function* (caller: User, competitionId: string, name: string) {
      yield* competitions.writable(caller, competitionId);

      return yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          const competition = yield* lockCompetition(tx, competitionId);

          if (!competition) {
            return yield* new CompetitionNotFound();
          }

          const live = yield* countLive(tx, competitionId);

          const [topic] = yield* Effect.promise(() =>
            tx
              .insert(topics)
              .values({ competitionId, name, position: live + 1 })
              .returning(columns),
          );

          return topic!;
        }),
      );
    });

    const update = Effect.fn("TopicsService.update")(function* (caller: User, id: string, patch: TopicUpdate) {
      const { competition_id: competitionId } = yield* writable(caller, id);

      return yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          const competition = yield* lockCompetition(tx, competitionId);

          if (!competition) {
            return yield* new TopicNotFound();
          }

          const current = yield* liveTopic(tx, id);

          if (!current) {
            return yield* new TopicNotFound();
          }

          let position: number | undefined;

          if (patch.position !== undefined) {
            const live = yield* countLive(tx, competitionId);
            const from = current.position;
            const to = Math.min(patch.position, live);

            if (to !== from) {
              const [submitted] = yield* Effect.promise(() =>
                tx
                  .select({ id: model.submissions.id })
                  .from(model.submissions)
                  .innerJoin(model.participants, eq(model.participants.id, model.submissions.participantId))
                  .where(and(eq(model.participants.competitionId, competitionId), isNull(model.participants.deletedAt)))
                  .limit(1),
              );

              if (submitted) {
                return yield* new TopicOrderLocked();
              }
            }

            if (to < from) {
              yield* Effect.promise(() =>
                tx
                  .update(topics)
                  .set({ position: sql`${topics.position} + 1` })
                  .where(and(liveIn(competitionId), gte(topics.position, to), lt(topics.position, from))),
              );
            } else if (to > from) {
              yield* Effect.promise(() =>
                tx
                  .update(topics)
                  .set({ position: sql`${topics.position} - 1` })
                  .where(and(liveIn(competitionId), gt(topics.position, from), lte(topics.position, to))),
              );
            }

            position = to;
          }

          const [topic] = yield* Effect.promise(() =>
            tx
              .update(topics)
              .set({ name: patch.name, position, updatedAt: sql`now()` })
              .where(eq(topics.id, id))
              .returning(columns),
          );

          return topic!;
        }),
      );
    });

    const remove = Effect.fn("TopicsService.remove")(function* (caller: User, id: string) {
      const { competition_id: competitionId } = yield* writable(caller, id);
      yield* transaction(db, (tx) =>
        Effect.gen(function* () {
          const competition = yield* lockCompetition(tx, competitionId);

          if (!competition) {
            return yield* new TopicNotFound();
          }

          const current = yield* liveTopic(tx, id);

          if (!current) {
            return yield* new TopicNotFound();
          }

          if (current.submissions > 0) {
            return yield* new TopicHasSubmissions();
          }

          if (competition.publishedAt) {
            const live = yield* countLive(tx, competitionId);

            if (live === 1) {
              return yield* new LastTopic();
            }
          }

          yield* Effect.promise(() =>
            tx
              .update(topics)
              .set({ deletedAt: sql`now()` })
              .where(eq(topics.id, id)),
          );
          yield* Effect.promise(() =>
            tx
              .update(topics)
              .set({ position: sql`${topics.position} - 1` })
              .where(and(liveIn(competitionId), gt(topics.position, current.position))),
          );
        }),
      );
    });

    return { list, get, create, update, remove };
  }),
}) {
  static readonly layer = Layer.effect(TopicsService, TopicsService.make).pipe(
    Layer.provide(CompetitionsService.layer),
  );
}
