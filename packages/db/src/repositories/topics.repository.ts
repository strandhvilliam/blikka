import { Effect, Layer, Context } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { marathons, submissions } from "../schema"
import { count, eq } from "drizzle-orm"
import { topics } from "../schema"
import type { Marathon, NewTopic, Topic } from "../types"
import { DbError } from "../utils"
interface ScheduledTopic extends Topic {
  marathon: Marathon
}

export class TopicsRepository extends Context.Service<
  TopicsRepository,
  {
    /** Topics belonging to a marathon, ordered by display order. */
    readonly getTopicsByMarathonId: (params: { id: number }) => Effect.Effect<Topic[], DbError>
    /** Topics belonging to the marathon identified by domain. */
    readonly getTopicsByDomain: (params: { domain: string }) => Effect.Effect<Topic[], DbError>
    /** Topic row by primary key, or null if missing. */
    readonly getTopicById: (params: { id: number }) => Effect.Effect<Topic | null, DbError>
    /** Patch fields on a topic identified by id. */
    readonly updateTopic: (params: {
      id: number
      data: Partial<NewTopic>
    }) => Effect.Effect<Topic, DbError>
    /** Rewrite topic order for a marathon and return the ordered topics. */
    readonly updateTopicsOrder: (params: {
      topicIds: number[]
      marathonId: number
    }) => Effect.Effect<Topic[], DbError>
    /** Insert a new topic row. */
    readonly createTopic: (params: { data: NewTopic }) => Effect.Effect<Topic, DbError>
    /** Delete a topic by id. */
    readonly deleteTopic: (params: { id: number }) => Effect.Effect<Topic, DbError>
    /** Topic ids with submission counts for the marathon identified by domain. */
    readonly getTopicsWithSubmissionCount: (params: {
      domain: string
    }) => Effect.Effect<{ id: number; count: number }[], DbError>
    /** Total submission count for a marathon. */
    readonly getTotalSubmissionCount: (params: {
      marathonId: number
    }) => Effect.Effect<number, DbError>
    /** First scheduled topic with its marathon, or undefined if none exist. */
    readonly getScheduledTopics: () => Effect.Effect<ScheduledTopic | undefined, DbError>
  }
>()("@blikka/db/topics-repository") {}

const makeTopicsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const getTopicsByMarathonId: TopicsRepository["Service"]["getTopicsByMarathonId"] = Effect.fn(
    "TopicsRepository.getTopicsByMarathonId",
  )(function* ({ id }) {
    const result = yield* use((db) =>
      db.query.topics.findMany({
        where: (table, operators) => operators.eq(table.marathonId, id),
        orderBy: (topics, { asc }) => [asc(topics.orderIndex)],
      }),
    )
    return result
  })

  const getTopicsByDomain: TopicsRepository["Service"]["getTopicsByDomain"] = Effect.fn(
    "TopicsRepository.getTopicsByDomain",
  )(function* ({ domain }) {
    const result = yield* use((db) =>
      db.query.marathons.findMany({
        where: (table, operators) => operators.eq(table.domain, domain),
        with: {
          topics: true,
        },
      }),
    )
    return result.flatMap(({ topics }) => topics)
  })

  const getTopicById: TopicsRepository["Service"]["getTopicById"] = Effect.fn(
    "TopicsRepository.getTopicById",
  )(function* ({ id }) {
    const result = yield* use((db) =>
      db.query.topics.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
      }),
    )
    return result ?? null
  })

  const updateTopic: TopicsRepository["Service"]["updateTopic"] = Effect.fn(
    "TopicsRepository.updateTopic",
  )(function* ({ id, data }) {
    const [result] = yield* use((db) =>
      db.update(topics).set(data).where(eq(topics.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to update topic",
        }),
      )
    }
    return result
  })

  const updateTopicsOrder: TopicsRepository["Service"]["updateTopicsOrder"] = Effect.fn(
    "TopicsRepository.updateTopicsOrder",
  )(function* ({ topicIds, marathonId }) {
    for (let index = 0; index < topicIds.length; index++) {
      const topicId = topicIds[index]
      if (topicId === undefined) {
        continue
      }
      yield* use((db) => db.update(topics).set({ orderIndex: index }).where(eq(topics.id, topicId)))
    }
    return yield* use((db) =>
      db.query.topics.findMany({
        where: (table, operators) => operators.eq(table.marathonId, marathonId),
        orderBy: (topics, { asc }) => [asc(topics.orderIndex)],
      }),
    )
  })

  const createTopic: TopicsRepository["Service"]["createTopic"] = Effect.fn(
    "TopicRepository.createTopic",
  )(function* ({ data }) {
    const [result] = yield* use((db) => db.insert(topics).values(data).returning())
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to create topic",
        }),
      )
    }
    return result
  })

  const deleteTopic: TopicsRepository["Service"]["deleteTopic"] = Effect.fn(
    "TopicRepository.deleteTopic",
  )(function* ({ id }) {
    const [result] = yield* use((db) => db.delete(topics).where(eq(topics.id, id)).returning())
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to delete topic",
        }),
      )
    }
    return result
  })

  const getTopicsWithSubmissionCount: TopicsRepository["Service"]["getTopicsWithSubmissionCount"] =
    Effect.fn("TopicRepository.getTopicsWithSubmissionCount")(function* ({ domain }) {
      const data = yield* use((db) =>
        db
          .select({
            id: topics.id,
            count: count(submissions.id),
          })
          .from(topics)
          .innerJoin(marathons, eq(topics.marathonId, marathons.id))
          .leftJoin(submissions, eq(topics.id, submissions.topicId))
          .where(eq(marathons.domain, domain))
          .groupBy(topics.id),
      )
      return data
    })

  const getTotalSubmissionCount: TopicsRepository["Service"]["getTotalSubmissionCount"] = Effect.fn(
    "TopicRepository.getTotalSubmissionCount",
  )(function* ({ marathonId }) {
    const [result] = yield* use((db) =>
      db
        .select({ count: count(submissions.id) })
        .from(submissions)
        .where(eq(submissions.marathonId, marathonId)),
    )
    return result?.count ?? 0
  })

  const getScheduledTopics: TopicsRepository["Service"]["getScheduledTopics"] = Effect.fn(
    "TopicRepository.getScheduledTopics",
  )(function* () {
    const [result] = yield* use((db) =>
      db.query.topics.findMany({
        where: (table, operators) => operators.eq(table.visibility, "scheduled"),
        with: {
          marathon: true,
        },
      }),
    )
    return result
  })

  return TopicsRepository.of({
    getTopicsByMarathonId,
    getTopicsByDomain,
    getTopicById,
    updateTopic,
    updateTopicsOrder,
    createTopic,
    deleteTopic,
    getTopicsWithSubmissionCount,
    getTotalSubmissionCount,
    getScheduledTopics,
  })
})

export const TopicsRepositoryLayerNoDeps = Layer.effect(TopicsRepository, makeTopicsRepository)

export const TopicsRepositoryLayer = TopicsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
