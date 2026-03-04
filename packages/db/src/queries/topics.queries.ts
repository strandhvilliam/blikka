import { Effect, Layer, ServiceMap } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { marathons, submissions } from "../schema"
import { count, eq } from "drizzle-orm"
import { topics } from "../schema"
import type { NewTopic } from "../types"
import { DbError } from "../utils"

export class TopicsQueries extends ServiceMap.Service<TopicsQueries>()(
  "@blikka/db/topics-queries",
  {
    make: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getTopicsByMarathonId = Effect.fn(
        "TopicsQueries.getTopicsByMarathonId"
      )(function* ({ id }: { id: number }) {
        const result = yield* db.query.topics.findMany({
          where: { marathonId: id },
          orderBy: (topics, { asc }) => [asc(topics.orderIndex)],
        })
        return result
      })

      const getTopicsByDomain = Effect.fn("TopicsQueries.getTopicsByDomain")(
        function* ({ domain }: { domain: string }) {
          const result = yield* db.query.marathons.findMany({
            where: { domain },
            with: {
              topics: true,
            },
          })
          return result.flatMap(({ topics }) => topics)
        }
      )

      const getTopicById = Effect.fn("TopicsQueries.getTopicById")(function* ({
        id,
      }: {
        id: number
      }) {
        const result = yield* db.query.topics.findFirst({
          where: { id },
        })
        return result ?? null
      })

      const updateTopic = Effect.fn("TopicsQueries.updateTopic")(function* ({
        id,
        data,
      }: {
        id: number
        data: Partial<NewTopic>
      }) {
        const [result] = yield* db
          .update(topics)
          .set(data)
          .where(eq(topics.id, id))
          .returning()

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update topic",
            })
          )
        }

        return result
      })

      const updateTopicsOrder = Effect.fn("TopicsQueries.updateTopicsOrder")(
        function* ({
          topicIds,
          marathonId,
        }: {
          topicIds: number[]
          marathonId: number
        }) {
          for (let index = 0; index < topicIds.length; index++) {
            const topicId = topicIds[index]
            if (topicId === undefined) {
              continue
            }
            yield* db
              .update(topics)
              .set({ orderIndex: index })
              .where(eq(topics.id, topicId))
          }

          return yield* db.query.topics.findMany({
            where: { marathonId },
            orderBy: (topics, { asc }) => [asc(topics.orderIndex)],
          })
        }
      )

      const createTopic = Effect.fn("TopicQueries.createTopic")(function* ({
        data,
      }: {
        data: NewTopic
      }) {
        const [result] = yield* db.insert(topics).values(data).returning()

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to create topic",
            })
          )
        }

        return result
      })

      const deleteTopic = Effect.fn("TopicQueries.deleteTopic")(function* ({
        id,
      }: {
        id: number
      }) {
        const [result] = yield* db
          .delete(topics)
          .where(eq(topics.id, id))
          .returning()
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to delete topic",
            })
          )
        }
        return result
      })

      const getTopicsWithSubmissionCount = Effect.fn(
        "TopicQueries.getTopicsWithSubmissionCount"
      )(function* ({ domain }: { domain: string }) {
        const data = yield* db
          .select({
            id: topics.id,
            count: count(submissions.id),
          })
          .from(topics)
          .innerJoin(marathons, eq(topics.marathonId, marathons.id))
          .leftJoin(submissions, eq(topics.id, submissions.topicId))
          .where(eq(marathons.domain, domain))
          .groupBy(topics.id)
        return data
      })

      const getTotalSubmissionCount = Effect.fn(
        "TopicQueries.getTotalSubmissionCount"
      )(function* ({ marathonId }: { marathonId: number }) {
        const [result] = yield* db
          .select({ count: count(submissions.id) })
          .from(submissions)
          .where(eq(submissions.marathonId, marathonId))

        return result?.count ?? 0
      })

      const getScheduledTopics = Effect.fn("TopicQueries.getScheduledTopics")(
        function* () {
          const [result] = yield* db.query.topics.findMany({
            where: { visibility: "scheduled" },
            with: {
              marathon: true,
            },
          })
          return result
        }
      )

      return {
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
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer)
  )
}
