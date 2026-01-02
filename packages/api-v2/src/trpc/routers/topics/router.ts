import "server-only"

import { Effect, Option } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import { Database } from "@blikka/db"
import {
  CreateTopicInputSchema,
  UpdateTopicInputSchema,
  DeleteTopicInputSchema,
  UpdateTopicsOrderInputSchema,
  TopicApiError,
} from "./schemas"

export const topicsRouter = createTRPCRouter({
  create: authProcedure.input(CreateTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.create")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        const db = yield* Database
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        })

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Marathon not found for domain ${input.domain}`,
            })
          )
        }

        // If orderIndex is not provided, set it to the end
        let orderIndex = input.data.orderIndex
        if (orderIndex === undefined) {
          const existingTopics = yield* db.topicsQueries.getTopicsByMarathonId({
            id: marathon.value.id,
          })
          orderIndex = existingTopics.length
        }

        return yield* db.topicsQueries.createTopic({
          data: {
            ...input.data,
            marathonId: marathon.value.id,
            orderIndex,
          },
        })
      })
    )
  ),

  update: authProcedure.input(UpdateTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.update")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        const db = yield* Database
        const topic = yield* db.topicsQueries.getTopicById({ id: input.id })

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${input.id}`,
            })
          )
        }

        // Verify topic belongs to the domain
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        })

        if (Option.isNone(marathon) || marathon.value.id !== topic.marathonId) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic does not belong to domain ${input.domain}`,
            })
          )
        }

        // Convert null to undefined for scheduledStart
        const updateData = {
          ...input.data,
          scheduledStart:
            input.data.scheduledStart === null
              ? undefined
              : input.data.scheduledStart,
        }

        return yield* db.topicsQueries.updateTopic({
          id: input.id,
          data: updateData,
        })
      })
    )
  ),

  delete: authProcedure.input(DeleteTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.delete")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        const db = yield* Database
        const topic = yield* db.topicsQueries.getTopicById({ id: input.id })

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${input.id}`,
            })
          )
        }

        // Verify topic belongs to the domain
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        })

        if (Option.isNone(marathon) || marathon.value.id !== topic.marathonId) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic does not belong to domain ${input.domain}`,
            })
          )
        }

        return yield* db.topicsQueries.deleteTopic({ id: input.id })
      })
    )
  ),

  updateOrder: authProcedure.input(UpdateTopicsOrderInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.updateOrder")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        const db = yield* Database
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        })

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Marathon not found for domain ${input.domain}`,
            })
          )
        }

        return yield* db.topicsQueries.updateTopicsOrder({
          topicIds: input.topicIds,
          marathonId: marathon.value.id,
        })
      })
    )
  ),
})

