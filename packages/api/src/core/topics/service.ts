import "server-only"

import {
  DbLayer,
  VotingRepository,
  TopicsRepository,
  MarathonsRepository,
  DbError,
  type NewTopic,
  type Topic,
} from "@blikka/db"
import { Effect, Layer, Context } from "effect"
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  failNotFoundIfNone,
} from "../errors"
import type {
  ActivateTopicInput,
  CreateTopicInput,
  DeleteTopicInput,
  GetTopicsWithSubmissionCountInput,
  UpdateTopicInput,
  UpdateTopicsOrderInput,
} from "./contracts"

const validateSubmissionWindow = Effect.fn("TopicsService.validateSubmissionWindow")(function* ({
  scheduledStart,
  scheduledEnd,
}: {
  scheduledStart?: string | null | undefined
  scheduledEnd?: string | null | undefined
}) {
  if (!scheduledStart || !scheduledEnd) {
    return
  }

  const start = new Date(scheduledStart)
  const end = new Date(scheduledEnd)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return yield* Effect.fail(new BadRequestError({ message: "Invalid submission window" }))
  }

  if (end <= start) {
    return yield* Effect.fail(
      new BadRequestError({
        message: "Submission end must be after the submission start",
      }),
    )
  }
})

export class TopicsService extends Context.Service<
  TopicsService,
  {
    /** Topic ids with submission counts for the marathon on `domain`. */
    readonly getTopicsWithSubmissionCount: (
      input: GetTopicsWithSubmissionCountInput,
    ) => Effect.Effect<{ id: number; count: number }[], DbError | NotFoundError, never>

    /** Creates a topic for `domain`, optionally activating it for by-camera flows (deactivates siblings). */
    readonly createTopic: (
      input: CreateTopicInput,
    ) => Effect.Effect<Topic, DbError | NotFoundError | BadRequestError, never>

    /** Updates a topic; blocks submission window changes once voting has started; handles activation peers. */
    readonly updateTopic: (
      input: UpdateTopicInput,
    ) => Effect.Effect<
      Topic,
      DbError | NotFoundError | BadRequestError | PreconditionFailedError,
      never
    >

    /** Sets one topic active for its marathon and demotes other active topics. */
    readonly activateTopic: (
      input: ActivateTopicInput,
    ) => Effect.Effect<Topic, DbError | NotFoundError, never>

    /** Deletes a topic after confirming it belongs to `domain`. */
    readonly deleteTopic: (
      input: DeleteTopicInput,
    ) => Effect.Effect<Topic, DbError | NotFoundError | ForbiddenError, never>

    /** Reorders topics within a marathon identified by `domain`. */
    readonly updateTopicsOrder: (
      input: UpdateTopicsOrderInput,
    ) => Effect.Effect<Topic[], DbError | NotFoundError, never>
  }
>()("@blikka/api/TopicsService") {}

const makeTopicsService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const topicsRepository = yield* TopicsRepository
  const votingRepository = yield* VotingRepository

  const getTopicsWithSubmissionCount: TopicsService["Service"]["getTopicsWithSubmissionCount"] =
    Effect.fn("TopicsService.getTopicsWithSubmissionCount")(function* ({ domain }) {
      yield* marathonsRepository
        .getMarathonByDomain({ domain })
        .pipe(failNotFoundIfNone("Marathon", { domain }))

      const data = yield* topicsRepository.getTopicsWithSubmissionCount({
        domain,
      })

      return data.map((row) => ({
        id: row.id,
        count: Number(row.count ?? 0),
      }))
    })

  const createTopic: TopicsService["Service"]["createTopic"] = Effect.fn(
    "TopicsService.createTopic",
  )(function* ({ domain, data }) {
    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone("Marathon", { domain }))

    const existingTopics = yield* topicsRepository.getTopicsByMarathonId({
      id: marathon.id,
    })

    let orderIndex = data.orderIndex
    if (orderIndex === undefined) {
      orderIndex = existingTopics.length
    }

    yield* validateSubmissionWindow({
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
    })

    const isByCamera = marathon.mode === "by-camera"
    const shouldActivate = isByCamera && (data.activate === true || data.visibility === "active")

    const { activate: _, ...createData } = data
    const createVisibility = createData.visibility === "active" ? "public" : createData.visibility

    const createdTopic = yield* topicsRepository.createTopic({
      data: {
        ...createData,
        visibility: createVisibility,
        marathonId: marathon.id,
        orderIndex,
      },
    })

    if (!shouldActivate) {
      return createdTopic
    }

    const currentlyActiveTopics = existingTopics.filter((topic) => topic.visibility === "active")
    yield* Effect.forEach(
      currentlyActiveTopics,
      (activeTopic) =>
        topicsRepository.updateTopic({
          id: activeTopic.id,
          data: { visibility: "public" },
        }),
      { concurrency: 1 },
    )

    const activatedAt = new Date().toISOString()
    yield* votingRepository.closeVotingWindowsForTopics({
      marathonId: marathon.id,
      topicIds: currentlyActiveTopics.map((activeTopic) => activeTopic.id),
      nowIso: activatedAt,
    })

    return yield* topicsRepository.updateTopic({
      id: createdTopic.id,
      data: {
        activatedAt,
        visibility: "active",
      },
    })
  })

  const updateTopic: TopicsService["Service"]["updateTopic"] = Effect.fn(
    "TopicsService.updateTopic",
  )(function* ({ id, data }) {
    const topic = yield* topicsRepository.getTopicById({ id })

    if (!topic) {
      return yield* Effect.fail(new NotFoundError({ resource: "Topic", identifier: { id } }))
    }

    const nextScheduledStart =
      data.scheduledStart === undefined ? topic.scheduledStart : data.scheduledStart
    const nextScheduledEnd =
      data.scheduledEnd === undefined ? topic.scheduledEnd : data.scheduledEnd

    const latestVotingRoundOpt = yield* votingRepository.getLatestVotingRoundForTopic({
      marathonId: topic.marathonId,
      topicId: topic.id,
    })

    if (latestVotingRoundOpt._tag === "Some") {
      const startChanged = nextScheduledStart !== topic.scheduledStart
      const endChanged = nextScheduledEnd !== topic.scheduledEnd
      if (startChanged || endChanged) {
        return yield* Effect.fail(
          new PreconditionFailedError({
            message: "Submission window cannot be changed after voting has started for this topic",
          }),
        )
      }
    }

    yield* validateSubmissionWindow({
      scheduledStart: nextScheduledStart,
      scheduledEnd: nextScheduledEnd,
    })

    const updateData: Partial<NewTopic> = {
      ...data,
      scheduledStart: data.scheduledStart === null ? undefined : data.scheduledStart,
      scheduledEnd: data.scheduledEnd === undefined ? undefined : data.scheduledEnd,
    }

    if (updateData.visibility === "active") {
      const siblingTopics = yield* topicsRepository.getTopicsByMarathonId({
        id: topic.marathonId,
      })
      const currentlyActiveTopics = siblingTopics.filter(
        (siblingTopic) => siblingTopic.id !== topic.id && siblingTopic.visibility === "active",
      )

      yield* Effect.forEach(
        currentlyActiveTopics,
        (activeTopic) =>
          topicsRepository.updateTopic({
            id: activeTopic.id,
            data: { visibility: "public" },
          }),
        { concurrency: 1 },
      )

      const activatedAt = updateData.activatedAt ?? new Date().toISOString()
      updateData.activatedAt = activatedAt
      yield* votingRepository.closeVotingWindowsForTopics({
        marathonId: topic.marathonId,
        topicIds: currentlyActiveTopics.map((activeTopic) => activeTopic.id),
        nowIso: activatedAt,
      })
    }

    return yield* topicsRepository.updateTopic({
      id,
      data: updateData,
    })
  })

  const activateTopic: TopicsService["Service"]["activateTopic"] = Effect.fn(
    "TopicsService.activateTopic",
  )(function* ({ id }) {
    const topic = yield* topicsRepository.getTopicById({ id })

    if (!topic) {
      return yield* Effect.fail(new NotFoundError({ resource: "Topic", identifier: { id } }))
    }

    const topics = yield* topicsRepository.getTopicsByMarathonId({
      id: topic.marathonId,
    })
    const currentlyActiveTopics = topics.filter(
      (candidateTopic) => candidateTopic.id !== id && candidateTopic.visibility === "active",
    )
    yield* Effect.forEach(
      currentlyActiveTopics,
      (activeTopic) =>
        topicsRepository.updateTopic({
          id: activeTopic.id,
          data: { visibility: "public" },
        }),
      { concurrency: 1 },
    )

    const activatedAt = new Date().toISOString()
    yield* votingRepository.closeVotingWindowsForTopics({
      marathonId: topic.marathonId,
      topicIds: currentlyActiveTopics.map((activeTopic) => activeTopic.id),
      nowIso: activatedAt,
    })

    return yield* topicsRepository.updateTopic({
      id,
      data: {
        activatedAt,
        visibility: "active",
      },
    })
  })

  const deleteTopic: TopicsService["Service"]["deleteTopic"] = Effect.fn(
    "TopicsService.deleteTopic",
  )(function* ({ id, domain }) {
    const topic = yield* topicsRepository.getTopicById({ id })

    if (!topic) {
      return yield* Effect.fail(new NotFoundError({ resource: "Topic", identifier: { id } }))
    }

    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone("Marathon", { domain }))

    if (marathon.id !== topic.marathonId) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: `Topic ${id} does not belong to domain ${domain}`,
        }),
      )
    }

    return yield* topicsRepository.deleteTopic({
      id,
    })
  })

  const updateTopicsOrder: TopicsService["Service"]["updateTopicsOrder"] = Effect.fn(
    "TopicsService.updateTopicsOrder",
  )(function* ({ domain, topicIds }) {
    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone("Marathon", { domain }))

    return yield* topicsRepository.updateTopicsOrder({
      topicIds: [...topicIds],
      marathonId: marathon.id,
    })
  })

  return TopicsService.of({
    getTopicsWithSubmissionCount,
    createTopic,
    updateTopic,
    activateTopic,
    deleteTopic,
    updateTopicsOrder,
  })
})

export const TopicsServiceLayerNoDeps = Layer.effect(TopicsService, makeTopicsService)

export const TopicsServiceLayer = TopicsServiceLayerNoDeps.pipe(Layer.provide(DbLayer))
