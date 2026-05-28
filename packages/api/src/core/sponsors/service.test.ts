import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import { MarathonsRepository, SponsorsRepository, type Sponsor } from '@blikka/db'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { NotFoundError } from '../errors'
import { SponsorsService, SponsorsServiceLayerNoDeps } from './service'
import { PublicMarathonCache } from '../upload-flow/public-marathon-cache'

const domain = 'demo'
const marathonId = 1
const bucketName = 'sponsors-bucket'

interface TestState {
  readonly marathon: { id: number; domain: string } | undefined
  readonly sponsors: Sponsor[]
  readonly createCalls: ReadonlyArray<Record<string, unknown>>
  readonly presignedUrlCalls: ReadonlyArray<{ bucket: string; key: string; method: string }>
  readonly invalidatedPublicMarathonDomains: ReadonlyArray<string>
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: { id: marathonId, domain },
  sponsors: [],
  createCalls: [],
  presignedUrlCalls: [],
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

  const sponsorsRepository = SponsorsRepository.of({
    getSponsorsByMarathonId: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.sponsors
      }),
    createSponsor: ({ data }: { data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        createCalls: [...state.createCalls, data],
      })).pipe(
        Effect.as({
          id: 1,
          marathonId,
          ...data,
        } as Sponsor),
      ),
  } as unknown as SponsorsRepository['Service'])

  const s3Service = S3Service.of({
    getPresignedUrl: (
      bucket: string,
      key: string,
      method: 'PUT' | 'GET',
      _options?: Record<string, unknown>,
    ) =>
      Effect.gen(function* () {
        yield* updateTestState(stateRef, (state) => ({
          ...state,
          presignedUrlCalls: [...state.presignedUrlCalls, { bucket, key, method }],
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

  return SponsorsServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(SponsorsRepository)(sponsorsRepository),
        Layer.succeed(S3Service)(s3Service),
        Layer.succeed(PublicMarathonCache)(publicMarathonCache),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, SponsorsService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(configLayerFromEnv({ SPONSORS_BUCKET_NAME: bucketName })),
  )

describe('SponsorsService', () => {
  it.effect('creates a sponsor under the resolved marathon', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* SponsorsService
          return yield* service.createSponsor({
            domain,
            type: 'live-landing',
            position: 'top-left',
            key: `${domain}/sponsors/logo.jpg`,
          })
        }),
      )

      const state = yield* Ref.get(stateRef)
      assert.equal(state.createCalls[0]?.marathonId, marathonId)
      assert.equal(state.createCalls[0]?.type, 'live-landing')
      assert.deepEqual(state.invalidatedPublicMarathonDomains, [domain])
    }),
  )

  it.effect('generates sponsor upload URLs under the marathon sponsors prefix', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* SponsorsService
          return yield* service.generateUploadUrl({
            domain,
            type: 'live-landing',
            position: 'top-left',
          })
        }),
      )

      assert.match(result.key, new RegExp(`^${domain}/sponsors/.+\\.jpg$`))
      assert.equal(state.presignedUrlCalls[0]?.bucket, bucketName)
      assert.equal(state.presignedUrlCalls[0]?.method, 'PUT')
      assert.equal(result.url, `https://example.com/${result.key}`)
      assert.deepEqual(state.invalidatedPublicMarathonDomains, [])
    }),
  )

  it.effect('fails listing sponsors when marathon is not found', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ marathon: undefined }))

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* SponsorsService
          return yield* Effect.flip(service.getSponsorsByMarathon({ domain }))
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, NotFoundError)
    }),
  )
})
