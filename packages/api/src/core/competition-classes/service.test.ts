import { assert, describe, it } from '@effect/vitest'
import {
  CompetitionClassesRepository,
  MarathonsRepository,
  type CompetitionClass,
} from '@blikka/db'
import { Effect, Layer, Option, Ref } from 'effect'

import { ForbiddenError, NotFoundError } from '../errors'
import {
  CompetitionClassesService,
  CompetitionClassesServiceLayerNoDeps,
} from './service'
import { PublicMarathonCache } from '../upload-flow/public-marathon-cache'

const domain = 'demo'
const marathonId = 1

interface TestState {
  readonly marathon: { id: number; domain: string } | undefined
  readonly competitionClass: CompetitionClass | undefined
  readonly createCalls: ReadonlyArray<Record<string, unknown>>
  readonly updateCalls: ReadonlyArray<{ id: number; data: Record<string, unknown> }>
  readonly deleteCalls: ReadonlyArray<number>
  readonly invalidatedPublicMarathonDomains: ReadonlyArray<string>
}

const makeCompetitionClass = (overrides: Partial<CompetitionClass> = {}): CompetitionClass =>
  ({
    id: 10,
    marathonId,
    name: 'Open',
    description: null,
    numberOfPhotos: 8,
    topicStartIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as CompetitionClass

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: { id: marathonId, domain },
  competitionClass: makeCompetitionClass(),
  createCalls: [],
  updateCalls: [],
  deleteCalls: [],
  invalidatedPublicMarathonDomains: [],
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

  const competitionClassesRepository = CompetitionClassesRepository.of({
    getCompetitionClassById: ({ id }: { id: number }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (state.competitionClass?.id === id) {
          return Option.some(state.competitionClass)
        }
        return Option.none()
      }),
    createCompetitionClass: ({ data }: { data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        createCalls: [...state.createCalls, data],
      })).pipe(Effect.as(makeCompetitionClass({ ...(data as Partial<CompetitionClass>) }))),
    updateCompetitionClass: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        updateCalls: [...state.updateCalls, { id, data }],
      })).pipe(Effect.as(makeCompetitionClass({ id, ...(data as Partial<CompetitionClass>) }))),
    deleteCompetitionClass: ({ id }: { id: number }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        deleteCalls: [...state.deleteCalls, id],
      })).pipe(Effect.as(makeCompetitionClass({ id }))),
  } as unknown as CompetitionClassesRepository['Service'])

  const publicMarathonCache = PublicMarathonCache.of({
    get: () => Effect.succeed(Option.none()),
    set: () => Effect.void,
    invalidate: (invalidateDomain: string) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        invalidatedPublicMarathonDomains: [
          ...state.invalidatedPublicMarathonDomains,
          invalidateDomain,
        ],
      })).pipe(Effect.asVoid),
  } as PublicMarathonCache['Service'])

  return CompetitionClassesServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(CompetitionClassesRepository)(competitionClassesRepository),
        Layer.succeed(PublicMarathonCache)(publicMarathonCache),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, CompetitionClassesService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(Effect.provide(makeTestLayer(stateRef)))

describe('CompetitionClassesService', () => {
  it.effect('defaults topicStartIndex to 0 when creating a class', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* CompetitionClassesService
          return yield* service.createCompetitionClass({
            domain,
            data: {
              name: 'Junior',
              numberOfPhotos: 8,
            },
          })
        }),
      )

      const state = yield* Ref.get(stateRef)
      assert.equal(state.createCalls[0]?.topicStartIndex, 0)
      assert.equal(state.createCalls[0]?.marathonId, marathonId)
      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('invalidates the public marathon cache after updating a class', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* CompetitionClassesService
          return yield* service.updateCompetitionClass({
            domain,
            id: 10,
            data: { name: 'Updated' },
          })
        }),
      )

      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('invalidates the public marathon cache after deleting a class', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* CompetitionClassesService
          return yield* service.deleteCompetitionClass({
            domain,
            id: 10,
          })
        }),
      )

      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('rejects updates when the class belongs to another marathon', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          competitionClass: makeCompetitionClass({ marathonId: 99 }),
        }),
      )

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* CompetitionClassesService
          return yield* Effect.flip(
            service.updateCompetitionClass({
              domain,
              id: 10,
              data: { name: 'Updated' },
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, ForbiddenError)
    }),
  )

  it.effect('fails delete when marathon is not found', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ marathon: undefined }))

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* CompetitionClassesService
          return yield* Effect.flip(
            service.deleteCompetitionClass({
              domain,
              id: 10,
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, NotFoundError)
    }),
  )
})
