import { assert, describe, it } from '@effect/vitest'
import {
  MarathonsRepository,
  TopicsRepository,
  VotingRepository,
  type Topic,
} from '@blikka/db'
import { Effect, Layer, Option, Ref } from 'effect'

import {
  BadRequestError,
  PreconditionFailedError,
} from '../errors'
import { makeTopic } from '../test/fixtures/topic'
import { TopicsService, TopicsServiceLayerNoDeps } from './service'

const domain = 'demo'
const marathonId = 1

interface TestState {
  readonly marathon: { id: number; domain: string; mode: 'marathon' | 'by-camera' } | undefined
  readonly topics: Topic[]
  readonly topicUpdates: ReadonlyArray<{ id: number; data: Partial<Topic> }>
  readonly createdTopics: ReadonlyArray<Partial<Topic>>
  readonly closedVotingTopicIds: number[][]
  readonly latestVotingRound: { _tag: 'Some' | 'None'; value?: { id: number } }
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: { id: marathonId, domain, mode: 'marathon' },
  topics: [makeTopic()],
  topicUpdates: [],
  createdTopics: [],
  closedVotingTopicIds: [],
  latestVotingRound: { _tag: 'None' },
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.marathon)
      }),
  } as unknown as MarathonsRepository['Service'])

  const topicsRepository = TopicsRepository.of({
    getTopicsByMarathonId: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.topics
      }),
    getTopicById: ({ id }: { id: number }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.topics.find((topic) => topic.id === id) ?? null
      }),
    createTopic: ({ data }: { data: Partial<Topic> }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const createdTopic = makeTopic({
          id: state.topics.length + 100,
          marathonId,
          ...data,
        })

        yield* updateTestState(stateRef, (current) => ({
          ...current,
          createdTopics: [...current.createdTopics, data],
          topics: [...current.topics, createdTopic],
        }))

        return createdTopic
      }),
    updateTopic: ({ id, data }: { id: number; data: Partial<Topic> }) =>
      Effect.gen(function* () {
        yield* updateTestState(stateRef, (state) => ({
          ...state,
          topicUpdates: [...state.topicUpdates, { id, data }],
          topics: state.topics.map((topic) =>
            topic.id === id ? ({ ...topic, ...data } as Topic) : topic,
          ),
        }))

        const state = yield* Ref.get(stateRef)
        const topic = state.topics.find((candidate) => candidate.id === id)
        if (!topic) {
          return yield* Effect.die(`Topic ${id} not found in test state`)
        }

        return topic
      }),
  } as unknown as TopicsRepository['Service'])

  const votingRepository = VotingRepository.of({
    getLatestVotingRoundForTopic: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.latestVotingRound
      }),
    closeVotingWindowsForTopics: ({
      topicIds,
    }: {
      marathonId: number
      topicIds: number[]
      nowIso: string
    }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        closedVotingTopicIds: [...state.closedVotingTopicIds, topicIds],
      })).pipe(Effect.asVoid),
  } as unknown as VotingRepository['Service'])

  return TopicsServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(TopicsRepository)(topicsRepository),
        Layer.succeed(VotingRepository)(votingRepository),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, TopicsService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(Effect.provide(makeTestLayer(stateRef)))

describe('TopicsService', () => {
  it.effect('rejects createTopic when submission end is not after start', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* TopicsService
          return yield* Effect.flip(
            service.createTopic({
              domain,
              data: {
                name: 'Late topic',
                visibility: 'public',
                scheduledStart: '2026-05-21T12:00:00.000Z',
                scheduledEnd: '2026-05-21T10:00:00.000Z',
              },
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, BadRequestError)
      if (error instanceof BadRequestError) {
        assert.include(error.message, 'Submission end must be after the submission start')
      }
    }),
  )

  it.effect('rejects createTopic when submission window timestamps are invalid', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* TopicsService
          return yield* Effect.flip(
            service.createTopic({
              domain,
              data: {
                name: 'Invalid topic',
                visibility: 'public',
                scheduledStart: 'not-a-date',
                scheduledEnd: '2026-05-21T12:00:00.000Z',
              },
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, BadRequestError)
      if (error instanceof BadRequestError) {
        assert.equal(error.message, 'Invalid submission window')
      }
    }),
  )

  it.effect('activateTopic demotes sibling active topics and activates the target topic', () =>
    Effect.gen(function* () {
      const activeSibling = makeTopic({ id: 1, visibility: 'active', name: 'Active sibling' })
      const targetTopic = makeTopic({ id: 2, visibility: 'public', name: 'Target topic' })
      const stateRef = yield* Ref.make(
        makeInitialState({
          topics: [activeSibling, targetTopic],
        }),
      )

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* TopicsService
          return yield* service.activateTopic({ domain, id: 2 })
        }),
      )

      assert.equal(result.visibility, 'active')
      assert.isDefined(result.activatedAt)
      assert.deepEqual(
        state.topicUpdates.map((update) => ({ id: update.id, visibility: update.data.visibility })),
        [
          { id: 1, visibility: 'public' },
          { id: 2, visibility: 'active' },
        ],
      )
      assert.deepEqual(state.closedVotingTopicIds, [[1]])
    }),
  )

  it.effect('blocks submission window changes after voting has started', () =>
    Effect.gen(function* () {
      const topic = makeTopic({
        id: 3,
        scheduledStart: '2026-05-21T10:00:00.000Z',
        scheduledEnd: '2026-05-21T12:00:00.000Z',
      })
      const stateRef = yield* Ref.make(
        makeInitialState({
          topics: [topic],
          latestVotingRound: { _tag: 'Some', value: { id: 99 } },
        }),
      )

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* TopicsService
          return yield* Effect.flip(
            service.updateTopic({
              domain,
              id: 3,
              data: {
                scheduledEnd: '2026-05-21T14:00:00.000Z',
              },
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, PreconditionFailedError)
      if (error instanceof PreconditionFailedError) {
        assert.include(error.message, 'Submission window cannot be changed')
      }
    }),
  )
})
