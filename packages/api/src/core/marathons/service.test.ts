import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import {
  CompetitionClassesRepository,
  MarathonsRepository,
  RulesRepository,
  UsersRepository,
  type Marathon,
} from '@blikka/db'
import { RULE_KEYS } from '@blikka/validation'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { MarathonService, MarathonServiceLayerNoDeps } from './service'
import { PublicMarathonCache } from '../upload-flow/public-marathon-cache'

const domain = 'demo'
const marathonId = 1
const bucketName = 'marathon-settings-bucket'

interface TestMarathon extends Marathon {
  topics: []
  sponsors: []
  ruleConfigs: []
  competitionClasses: []
  deviceGroups: []
}

interface TestState {
  readonly marathon: TestMarathon | undefined
  readonly createdCompetitionClasses: ReadonlyArray<Record<string, unknown>>
  readonly updatedRules: ReadonlyArray<Record<string, unknown>>
  readonly presignedUrlCalls: ReadonlyArray<{ bucket: string; key: string }>
  readonly invalidatedPublicMarathonDomains: ReadonlyArray<string>
}

const makeMarathon = (overrides: Partial<TestMarathon> = {}): TestMarathon =>
  ({
    id: marathonId,
    domain,
    mode: 'marathon',
    setupCompleted: true,
    startDate: '2026-05-21T10:00:00.000Z',
    endDate: '2026-05-21T18:00:00.000Z',
    topics: [],
    sponsors: [],
    ruleConfigs: [],
    competitionClasses: [],
    deviceGroups: [],
    ...overrides,
  }) as TestMarathon

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: makeMarathon(),
  createdCompetitionClasses: [],
  updatedRules: [],
  presignedUrlCalls: [],
  invalidatedPublicMarathonDomains: [],
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomainWithOptions: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.marathon)
      }),
    getMarathonByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.marathon)
      }),
    updateMarathonByDomain: ({ data }: { domain: string; data: Record<string, unknown> }) =>
      Effect.gen(function* () {
        yield* updateTestState(stateRef, (state) => ({
          ...state,
          marathon: state.marathon
            ? ({ ...state.marathon, ...data } as TestMarathon)
            : state.marathon,
        }))
        const state = yield* Ref.get(stateRef)
        return state.marathon!
      }),
    resetMarathon: ({ id }: { id: number }) => Effect.succeed({ id }),
  } as unknown as MarathonsRepository['Service'])

  const competitionClassesRepository = CompetitionClassesRepository.of({
    createCompetitionClass: ({ data }: { data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        createdCompetitionClasses: [...state.createdCompetitionClasses, data],
      })).pipe(Effect.asVoid),
  } as unknown as CompetitionClassesRepository['Service'])

  const rulesRepository = RulesRepository.of({
    getRulesByDomain: () =>
      Effect.succeed([
        {
          id: 5,
          ruleKey: RULE_KEYS.WITHIN_TIMERANGE,
          params: { start: '2026-05-21T10:00:00.000Z', end: '2026-05-21T18:00:00.000Z' },
        },
      ]),
    updateRuleConfig: ({ data }: { id: number; data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        updatedRules: [...state.updatedRules, data],
      })).pipe(Effect.asVoid),
  } as unknown as RulesRepository['Service'])

  const usersRepository = UsersRepository.of({} as unknown as UsersRepository['Service'])

  const s3Service = S3Service.of({
    getPresignedUrl: (bucket: string, key: string) =>
      Effect.gen(function* () {
        yield* updateTestState(stateRef, (state) => ({
          ...state,
          presignedUrlCalls: [...state.presignedUrlCalls, { bucket, key }],
        }))
        return `https://example.com/${key}`
      }),
  } as unknown as S3Service['Service'])

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

  return MarathonServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(CompetitionClassesRepository)(competitionClassesRepository),
        Layer.succeed(RulesRepository)(rulesRepository),
        Layer.succeed(UsersRepository)(usersRepository),
        Layer.succeed(S3Service)(s3Service),
        Layer.succeed(PublicMarathonCache)(publicMarathonCache),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, MarathonService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(configLayerFromEnv({ MARATHON_SETTINGS_BUCKET_NAME: bucketName })),
  )

describe('MarathonService', () => {
  it.effect('creates a default competition class for by-camera marathons without one', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          marathon: makeMarathon({ mode: 'by-camera', competitionClasses: [] }),
        }),
      )

      yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* MarathonService
          return yield* service.getMarathonByDomain({ domain })
        }),
      )

      const state = yield* Ref.get(stateRef)
      assert.equal(state.createdCompetitionClasses.length, 1)
      assert.equal(state.createdCompetitionClasses[0]?.marathonId, marathonId)
      assert.equal(state.createdCompetitionClasses[0]?.numberOfPhotos, 1)
    }),
  )

  it.effect('increments logo version when generating a new upload URL', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* MarathonService
          return yield* service.getLogoUploadUrl({
            domain,
            currentKey: `${domain}/logo?v=2`,
          })
        }),
      )

      assert.equal(result.key, `${domain}/logo?v=3`)
      assert.include(result.publicUrl, `${bucketName}.s3.eu-north-1.amazonaws.com`)
      assert.include(result.publicUrl, `${domain}/logo`)
    }),
  )

  it.effect('syncs within-timerange rule params when marathon dates change', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* MarathonService
          return yield* service.updateMarathon({
            domain,
            data: {
              startDate: '2026-06-01T08:00:00.000Z',
              endDate: '2026-06-01T20:00:00.000Z',
            },
          })
        }),
      )

      const state = yield* Ref.get(stateRef)
      assert.deepEqual(state.updatedRules[0]?.params, {
        start: '2026-06-01T08:00:00.000Z',
        end: '2026-06-01T20:00:00.000Z',
      })
      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('invalidates the public marathon cache after updating marathon settings', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* MarathonService
          return yield* service.updateMarathon({
            domain,
            data: { name: 'Updated marathon' },
          })
        }),
      )

      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('invalidates the public marathon cache after resetting marathon data', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* MarathonService
          return yield* service.resetMarathon({ domain })
        }),
      )

      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )
})
