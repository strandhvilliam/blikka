import "server-only";

import { Database, type NewTopic } from "@blikka/db";
import { Effect, Layer, Option, ServiceMap } from "effect";
import { TopicApiError } from "./schemas";

type TopicVisibility = "public" | "private" | "scheduled" | "active";

export class TopicsApiService extends ServiceMap.Service<TopicsApiService>()(
  "@blikka/api/TopicsApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database;

      const getTopicsWithSubmissionCount = Effect.fn(
        "TopicsApiService.getTopicsWithSubmissionCount",
      )(function* ({ domain }: { domain: string }) {
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          );
        }

        const data = yield* db.topicsQueries.getTopicsWithSubmissionCount({
          domain,
        });

        return data.map((row) => ({
          id: row.id,
          count: Number(row.count ?? 0),
        }));
      });

      const createTopic = Effect.fn("TopicsApiService.createTopic")(function* ({
        domain,
        data,
      }: {
        domain: string;
        data: {
          name: string;
          visibility: TopicVisibility;
          activate?: boolean;
          scheduledStart?: string;
          orderIndex?: number;
        };
      }) {
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          );
        }

        const existingTopics = yield* db.topicsQueries.getTopicsByMarathonId({
          id: marathon.value.id,
        });

        let orderIndex = data.orderIndex;
        if (orderIndex === undefined) {
          orderIndex = existingTopics.length;
        }

        const isByCamera = marathon.value.mode === "by-camera";
        const shouldActivate =
          isByCamera && (data.activate === true || data.visibility === "active");

        const { activate: _, ...createData } = data;
        const createVisibility =
          createData.visibility === "active" ? "public" : createData.visibility;

        const createdTopic = yield* db.topicsQueries.createTopic({
          data: {
            ...createData,
            visibility: createVisibility,
            marathonId: marathon.value.id,
            orderIndex,
          },
        });

        if (!shouldActivate) {
          return createdTopic;
        }

        const currentlyActiveTopics = existingTopics.filter(
          (topic) => topic.visibility === "active",
        );
        yield* Effect.forEach(
          currentlyActiveTopics,
          (activeTopic) =>
            db.topicsQueries.updateTopic({
              id: activeTopic.id,
              data: { visibility: "public" },
            }),
          { concurrency: 1 },
        );

        const activatedAt = new Date().toISOString();
        yield* db.votingQueries.closeVotingWindowsForTopics({
          marathonId: marathon.value.id,
          topicIds: currentlyActiveTopics.map((activeTopic) => activeTopic.id),
          nowIso: activatedAt,
        });

        return yield* db.topicsQueries.updateTopic({
          id: createdTopic.id,
          data: {
            activatedAt,
            visibility: "active",
          },
        });
      });

      const updateTopic = Effect.fn("TopicsApiService.updateTopic")(function* ({
        id,
        data,
      }: {
        id: number;
        data: {
          name?: string;
          visibility?: TopicVisibility;
          scheduledStart?: string | null | undefined;
          orderIndex?: number;
        };
      }) {
        const topic = yield* db.topicsQueries.getTopicById({ id });

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${id}`,
            }),
          );
        }

        const updateData: Partial<NewTopic> = {
          ...data,
          scheduledStart: data.scheduledStart === null ? undefined : data.scheduledStart,
        };

        if (updateData.visibility === "active") {
          const siblingTopics = yield* db.topicsQueries.getTopicsByMarathonId({
            id: topic.marathonId,
          });
          const currentlyActiveTopics = siblingTopics.filter(
            (siblingTopic) =>
              siblingTopic.id !== topic.id &&
              siblingTopic.visibility === "active",
          );

          yield* Effect.forEach(
            currentlyActiveTopics,
            (activeTopic) =>
              db.topicsQueries.updateTopic({
                id: activeTopic.id,
                data: { visibility: "public" },
              }),
            { concurrency: 1 },
          );

          const activatedAt = updateData.activatedAt ?? new Date().toISOString();
          updateData.activatedAt = activatedAt;
          yield* db.votingQueries.closeVotingWindowsForTopics({
            marathonId: topic.marathonId,
            topicIds: currentlyActiveTopics.map((activeTopic) => activeTopic.id),
            nowIso: activatedAt,
          });
        }

        return yield* db.topicsQueries.updateTopic({
          id,
          data: updateData,
        });
      });

      const activateTopic = Effect.fn("TopicsApiService.activateTopic")(function* ({
        id,
      }: {
        id: number;
      }) {
        const topic = yield* db.topicsQueries.getTopicById({ id });

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${id}`,
            }),
          );
        }

        const topics = yield* db.topicsQueries.getTopicsByMarathonId({
          id: topic.marathonId,
        });
        const currentlyActiveTopics = topics.filter(
          (candidateTopic) =>
            candidateTopic.id !== id && candidateTopic.visibility === "active",
        );
        yield* Effect.forEach(
          currentlyActiveTopics,
          (activeTopic) =>
            db.topicsQueries.updateTopic({
              id: activeTopic.id,
              data: { visibility: "public" },
            }),
          { concurrency: 1 },
        );

        const activatedAt = new Date().toISOString();
        yield* db.votingQueries.closeVotingWindowsForTopics({
          marathonId: topic.marathonId,
          topicIds: currentlyActiveTopics.map((activeTopic) => activeTopic.id),
          nowIso: activatedAt,
        });

        return yield* db.topicsQueries.updateTopic({
          id,
          data: {
            activatedAt,
            visibility: "active",
          },
        });
      });

      const deleteTopic = Effect.fn("TopicsApiService.deleteTopic")(function* ({
        id,
        domain,
      }: {
        id: number;
        domain: string;
      }) {
        const topic = yield* db.topicsQueries.getTopicById({ id });

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${id}`,
            }),
          );
        }

        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon) || marathon.value.id !== topic.marathonId) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic does not belong to domain ${domain}`,
            }),
          );
        }

        return yield* db.topicsQueries.deleteTopic({
          id,
        });
      });

      const updateTopicsOrder = Effect.fn("TopicsApiService.updateTopicsOrder")(function* ({
        domain,
        topicIds,
      }: {
        domain: string;
        topicIds: readonly number[];
      }) {
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          );
        }

        return yield* db.topicsQueries.updateTopicsOrder({
          topicIds: [...topicIds],
          marathonId: marathon.value.id,
        });
      });

      return {
        getTopicsWithSubmissionCount,
        createTopic,
        updateTopic,
        activateTopic,
        deleteTopic,
        updateTopicsOrder,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Database.layer),
  );
}
