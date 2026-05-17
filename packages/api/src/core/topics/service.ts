import "server-only";

import {
  DbLayer,
  VotingRepository,
  TopicsRepository,
  MarathonsRepository,
  type NewTopic,
} from "@blikka/db";
import { Effect, Layer, Option, Context } from "effect";
import { TopicApiError } from "./errors";
import type {
  ActivateTopicInput,
  CreateTopicInput,
  DeleteTopicInput,
  GetTopicsWithSubmissionCountInput,
  UpdateTopicInput,
  UpdateTopicsOrderInput,
} from "./contracts";

function validateSubmissionWindow({
  scheduledStart,
  scheduledEnd,
}: {
  scheduledStart?: string | null | undefined;
  scheduledEnd?: string | null | undefined;
}) {
  if (!scheduledStart || !scheduledEnd) {
    return;
  }

  const start = new Date(scheduledStart);
  const end = new Date(scheduledEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new TopicApiError({
      message: "Invalid submission window",
    });
  }

  if (end <= start) {
    throw new TopicApiError({
      message: "Submission end must be after the submission start",
    });
  }
}

export class TopicsService extends Context.Service<TopicsService>()(
  "@blikka/api/TopicsService",
  {
    make: Effect.gen(function* () {
      const marathonsRepository = yield* MarathonsRepository;
      const topicsRepository = yield* TopicsRepository;
      const votingRepository = yield* VotingRepository;

      const getTopicsWithSubmissionCount = Effect.fn(
        "TopicsService.getTopicsWithSubmissionCount",
      )(function* ({ domain }: GetTopicsWithSubmissionCountInput) {
        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          );
        }

        const data = yield* topicsRepository.getTopicsWithSubmissionCount({
          domain,
        });

        return data.map((row) => ({
          id: row.id,
          count: Number(row.count ?? 0),
        }));
      });

      const createTopic = Effect.fn("TopicsService.createTopic")(function* ({
        domain,
        data,
      }: CreateTopicInput) {
        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          );
        }

        const existingTopics = yield* topicsRepository.getTopicsByMarathonId({
          id: marathon.value.id,
        });

        let orderIndex = data.orderIndex;
        if (orderIndex === undefined) {
          orderIndex = existingTopics.length;
        }

        validateSubmissionWindow({
          scheduledStart: data.scheduledStart,
          scheduledEnd: data.scheduledEnd,
        });

        const isByCamera = marathon.value.mode === "by-camera";
        const shouldActivate =
          isByCamera &&
          (data.activate === true || data.visibility === "active");

        const { activate: _, ...createData } = data;
        const createVisibility =
          createData.visibility === "active" ? "public" : createData.visibility;

        const createdTopic = yield* topicsRepository.createTopic({
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
            topicsRepository.updateTopic({
              id: activeTopic.id,
              data: { visibility: "public" },
            }),
          { concurrency: 1 },
        );

        const activatedAt = new Date().toISOString();
        yield* votingRepository.closeVotingWindowsForTopics({
          marathonId: marathon.value.id,
          topicIds: currentlyActiveTopics.map((activeTopic) => activeTopic.id),
          nowIso: activatedAt,
        });

        return yield* topicsRepository.updateTopic({
          id: createdTopic.id,
          data: {
            activatedAt,
            visibility: "active",
          },
        });
      });

      const updateTopic = Effect.fn("TopicsService.updateTopic")(function* ({
        id,
        data,
      }: UpdateTopicInput) {
        const topic = yield* topicsRepository.getTopicById({ id });

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${id}`,
            }),
          );
        }

        const nextScheduledStart =
          data.scheduledStart === undefined
            ? topic.scheduledStart
            : data.scheduledStart;
        const nextScheduledEnd =
          data.scheduledEnd === undefined
            ? topic.scheduledEnd
            : data.scheduledEnd;

        const latestVotingRoundOpt =
          yield* votingRepository.getLatestVotingRoundForTopic({
            marathonId: topic.marathonId,
            topicId: topic.id,
          });

        if (Option.isSome(latestVotingRoundOpt)) {
          const startChanged = nextScheduledStart !== topic.scheduledStart;
          const endChanged = nextScheduledEnd !== topic.scheduledEnd;
          if (startChanged || endChanged) {
            return yield* Effect.fail(
              new TopicApiError({
                message:
                  "Submission window cannot be changed after voting has started for this topic",
              }),
            );
          }
        }

        validateSubmissionWindow({
          scheduledStart: nextScheduledStart,
          scheduledEnd: nextScheduledEnd,
        });

        const updateData: Partial<NewTopic> = {
          ...data,
          scheduledStart:
            data.scheduledStart === null ? undefined : data.scheduledStart,
          scheduledEnd:
            data.scheduledEnd === undefined ? undefined : data.scheduledEnd,
        };

        if (updateData.visibility === "active") {
          const siblingTopics = yield* topicsRepository.getTopicsByMarathonId({
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
              topicsRepository.updateTopic({
                id: activeTopic.id,
                data: { visibility: "public" },
              }),
            { concurrency: 1 },
          );

          const activatedAt =
            updateData.activatedAt ?? new Date().toISOString();
          updateData.activatedAt = activatedAt;
          yield* votingRepository.closeVotingWindowsForTopics({
            marathonId: topic.marathonId,
            topicIds: currentlyActiveTopics.map(
              (activeTopic) => activeTopic.id,
            ),
            nowIso: activatedAt,
          });
        }

        return yield* topicsRepository.updateTopic({
          id,
          data: updateData,
        });
      });

      const activateTopic = Effect.fn("TopicsService.activateTopic")(
        function* ({ id }: ActivateTopicInput) {
          const topic = yield* topicsRepository.getTopicById({ id });

          if (!topic) {
            return yield* Effect.fail(
              new TopicApiError({
                message: `Topic not found with id ${id}`,
              }),
            );
          }

          const topics = yield* topicsRepository.getTopicsByMarathonId({
            id: topic.marathonId,
          });
          const currentlyActiveTopics = topics.filter(
            (candidateTopic) =>
              candidateTopic.id !== id &&
              candidateTopic.visibility === "active",
          );
          yield* Effect.forEach(
            currentlyActiveTopics,
            (activeTopic) =>
              topicsRepository.updateTopic({
                id: activeTopic.id,
                data: { visibility: "public" },
              }),
            { concurrency: 1 },
          );

          const activatedAt = new Date().toISOString();
          yield* votingRepository.closeVotingWindowsForTopics({
            marathonId: topic.marathonId,
            topicIds: currentlyActiveTopics.map(
              (activeTopic) => activeTopic.id,
            ),
            nowIso: activatedAt,
          });

          return yield* topicsRepository.updateTopic({
            id,
            data: {
              activatedAt,
              visibility: "active",
            },
          });
        },
      );

      const deleteTopic = Effect.fn("TopicsService.deleteTopic")(function* ({
        id,
        domain,
      }: DeleteTopicInput) {
        const topic = yield* topicsRepository.getTopicById({ id });

        if (!topic) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic not found with id ${id}`,
            }),
          );
        }

        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon) || marathon.value.id !== topic.marathonId) {
          return yield* Effect.fail(
            new TopicApiError({
              message: `Topic does not belong to domain ${domain}`,
            }),
          );
        }

        return yield* topicsRepository.deleteTopic({
          id,
        });
      });

      const updateTopicsOrder = Effect.fn("TopicsService.updateTopicsOrder")(
        function* ({ domain, topicIds }: UpdateTopicsOrderInput) {
          const marathon = yield* marathonsRepository.getMarathonByDomain({
            domain,
          });

          if (Option.isNone(marathon)) {
            return yield* Effect.fail(
              new TopicApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            );
          }

          return yield* topicsRepository.updateTopicsOrder({
            topicIds: [...topicIds],
            marathonId: marathon.value.id,
          });
        },
      );

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
    Layer.provide(DbLayer),
  );
}
