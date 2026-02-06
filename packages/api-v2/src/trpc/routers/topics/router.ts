import "server-only";

import { Effect, Option } from "effect";
import { createTRPCRouter, domainProcedure } from "../../root";
import { trpcEffect } from "../../utils";
import { Database, type NewTopic } from "@blikka/db";
import {
  CreateTopicInputSchema,
  UpdateTopicInputSchema,
  DeleteTopicInputSchema,
  UpdateTopicsOrderInputSchema,
  GetTopicsWithSubmissionCountInputSchema,
  ActivateTopicInputSchema,
  TopicApiError,
} from "./schemas";

export const topicsRouter = createTRPCRouter({
  getWithSubmissionCount: domainProcedure
    .input(GetTopicsWithSubmissionCountInputSchema)
    .query(
      trpcEffect(
        Effect.fn("TopicsRouter.getWithSubmissionCount")(function* ({ input }) {
          const db = yield* Database;
          const marathon = yield* db.marathonsQueries.getMarathonByDomain({
            domain: input.domain,
          });

          if (Option.isNone(marathon)) {
            return yield* Effect.fail(
              new TopicApiError({
                message: `Marathon not found for domain ${input.domain}`,
              }),
            );
          }

          const data = yield* db.topicsQueries.getTopicsWithSubmissionCount({
            domain: input.domain,
          });

          return data.map((row) => ({
            id: row.id,
            count: Number(row.count ?? 0),
          }));
        }),
      ),
    ),
  create: domainProcedure.input(CreateTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.create")(function* ({ input }) {
        const db = yield* Database;
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Marathon not found for domain ${input.domain}`,
            }),
          );
        }

        const existingTopics = yield* db.topicsQueries.getTopicsByMarathonId({
          id: marathon.value.id,
        });

        // If orderIndex is not provided, set it to the end
        let orderIndex = input.data.orderIndex;
        if (orderIndex === undefined) {
          orderIndex = existingTopics.length;
        }

        const isByCamera = marathon.value.mode === "by-camera";
        const shouldActivate = isByCamera && input.data.activate === true;

        const { activate: _, ...createData } = input.data;

        const createdTopic = yield* db.topicsQueries.createTopic({
          data: {
            ...createData,
            marathonId: marathon.value.id,
            orderIndex,
          },
        });

        if (!shouldActivate) {
          return createdTopic;
        }

        const sortedExisting = [...existingTopics].sort(
          (a, b) => a.orderIndex - b.orderIndex,
        );
        const topicIds = [
          createdTopic.id,
          ...sortedExisting.map((topic) => topic.id),
        ];

        yield* db.topicsQueries.updateTopicsOrder({
          topicIds,
          marathonId: marathon.value.id,
        });

        const activatedAt = new Date().toISOString();

        return yield* db.topicsQueries.updateTopic({
          id: createdTopic.id,
          data: {
            activatedAt,
          },
        });
      }),
    ),
  ),

  update: domainProcedure.input(UpdateTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.update")(function* ({ input }) {
        const db = yield* Database;
        const topic = yield* db.topicsQueries.getTopicById({ id: input.id });

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${input.id}`,
            }),
          );
        }

        const { ...updateInput } = input.data;

        // Convert null to undefined for scheduledStart
        const updateData: Partial<NewTopic> = {
          ...updateInput,
          scheduledStart:
            input.data.scheduledStart === null
              ? undefined
              : input.data.scheduledStart,
        };

        return yield* db.topicsQueries.updateTopic({
          id: input.id,
          data: updateData,
        });
      }),
    ),
  ),

  activate: domainProcedure.input(ActivateTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.activate")(function* ({ input }) {
        const db = yield* Database;
        const topic = yield* db.topicsQueries.getTopicById({ id: input.id });

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${input.id}`,
            }),
          );
        }


        const topics = yield* db.topicsQueries.getTopicsByMarathonId({
          id: topic.marathonId,
        });
        const sortedTopics = [...topics].sort(
          (a, b) => a.orderIndex - b.orderIndex,
        );
        const topicIds = [
          input.id,
          ...sortedTopics.filter((t) => t.id !== input.id).map((t) => t.id),
        ];

        yield* db.topicsQueries.updateTopicsOrder({
          topicIds,
          marathonId: topic.marathonId,
        });

        const activatedAt = new Date().toISOString();

        return yield* db.topicsQueries.updateTopic({
          id: input.id,
          data: {
            activatedAt,
          },
        });
      }),
    ),
  ),

  delete: domainProcedure.input(DeleteTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.delete")(function* ({ input }) {
        const db = yield* Database;
        const topic = yield* db.topicsQueries.getTopicById({ id: input.id });

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${input.id}`,
            }),
          );
        }

        // Verify topic belongs to the domain
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        });

        if (Option.isNone(marathon) || marathon.value.id !== topic.marathonId) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic does not belong to domain ${input.domain}`,
            }),
          );
        }

        const deletedTopic = yield* db.topicsQueries.deleteTopic({
          id: input.id,
        });

        if (marathon.value.mode === "by-camera") {
          const remainingTopics = yield* db.topicsQueries.getTopicsByMarathonId(
            {
              id: marathon.value.id,
            },
          );
          if (remainingTopics.length > 0) {
            const orderedIds = [...remainingTopics]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((topic) => topic.id);
            yield* db.topicsQueries.updateTopicsOrder({
              topicIds: orderedIds,
              marathonId: marathon.value.id,
            });
          }
        }

        return deletedTopic;
      }),
    ),
  ),

  updateOrder: domainProcedure.input(UpdateTopicsOrderInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.updateOrder")(function* ({ input }) {
        const db = yield* Database;
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Marathon not found for domain ${input.domain}`,
            }),
          );
        }

        return yield* db.topicsQueries.updateTopicsOrder({
          topicIds: [...input.topicIds],
          marathonId: marathon.value.id,
        });
      }),
    ),
  ),
});
