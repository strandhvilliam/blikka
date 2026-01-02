import { Effect } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { marathons, submissions } from "../schema"
import { count, eq } from "drizzle-orm"
import { topics } from "../schema"
import type { NewTopic } from "../types"
import { SqlError } from "@effect/sql/SqlError"
// import { SupabaseClient } from "../supabase-client"

export class TopicsQueries extends Effect.Service<TopicsQueries>()(
  "@blikka/db/topics-queries",
  {
    dependencies: [DrizzleClient.Default],
    effect: Effect.gen(function* () {
      const db = yield* DrizzleClient
      // const supabase = yield* SupabaseClient

      const getTopicsByMarathonId = Effect.fn(
        "TopicsQueries.getTopicsByMarathonId"
      )(function* ({ id }: { id: number }) {
        const result = yield* db.query.topics.findMany({
          where: eq(topics.marathonId, id),
          orderBy: (topics, { asc }) => [asc(topics.orderIndex)],
        })
        return result
      })

      const getTopicsByDomain = Effect.fn("TopicsQueries.getTopicsByDomain")(
        function* ({ domain }: { domain: string }) {
          const result = yield* db.query.marathons.findMany({
            where: eq(marathons.domain, domain),
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
          where: eq(topics.id, id),
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
            new SqlError({
              cause: "Failed to update topic",
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
          // Update each topic's orderIndex based on its position in the array
          for (let index = 0; index < topicIds.length; index++) {
            const topicId = topicIds[index]
            yield* db
              .update(topics)
              .set({ orderIndex: index })
              .where(eq(topics.id, topicId))
          }

          // Return the updated topics
          return yield* db.query.topics.findMany({
            where: eq(topics.marathonId, marathonId),
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
            new SqlError({
              cause: "Failed to create topic",
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
            new SqlError({
              cause: "Failed to delete topic",
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
            where: eq(topics.visibility, "scheduled"),
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
      }
    }),
  }
) {}
