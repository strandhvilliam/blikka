import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import { SubmissionsRepository } from '@blikka/db'
import {
  ExifKVRepository,
  type ExifState,
  type SubmissionState,
  UploadSessionRepository,
} from '@blikka/kv-store'
import { Effect, Layer, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import {
  UploadProvisionerService,
  UploadProvisionerServiceLayerNoDeps,
} from './provision-upload'

const domain = 'demo'
const reference = '1234'
const orderIndex = 2
const submissionKey = `${domain}/${reference}/02/photo.jpg`

interface TestState {
  readonly exifDeletes: ReadonlyArray<{
    domain: string
    reference: string
    orderIndexes: readonly number[]
  }>
  readonly exifSets: ReadonlyArray<{
    domain: string
    reference: string
    orderIndex: number
    exif: ExifState
  }>
  readonly submissionCreates: ReadonlyArray<{
    participantId: number
    key: string
    marathonId: number
    topicId: number
  }>
  readonly kvInitializeCalls: ReadonlyArray<{
    domain: string
    reference: string
    uploadSessionId: string
    keys: readonly string[]
  }>
  readonly presignedUrlCalls: ReadonlyArray<{
    bucket: string
    key: string
    method: string
    contentType: string
  }>
  readonly generatedKey: string
  readonly presignedUrl: string
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  exifDeletes: [],
  exifSets: [],
  submissionCreates: [],
  kvInitializeCalls: [],
  presignedUrlCalls: [],
  generatedKey: submissionKey,
  presignedUrl: 'https://example.com/presigned',
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const exifKv = ExifKVRepository.of({
    deleteExifStates: (
      deleteDomain: string,
      deleteReference: string,
      orderIndexes: readonly number[],
    ) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        exifDeletes: [
          ...state.exifDeletes,
          { domain: deleteDomain, reference: deleteReference, orderIndexes },
        ],
      })).pipe(Effect.as(undefined)),
    setExifState: (
      setDomain: string,
      setReference: string,
      setOrderIndex: number,
      exif: ExifState,
    ) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        exifSets: [
          ...state.exifSets,
          {
            domain: setDomain,
            reference: setReference,
            orderIndex: setOrderIndex,
            exif,
          },
        ],
      })).pipe(Effect.as('OK' as const)),
  } as unknown as ExifKVRepository['Service'])

  const s3 = S3Service.of({
    generateSubmissionKey: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.generatedKey
      }),
    getPresignedUrl: (
      bucket: string,
      key: string,
      method: 'PUT' | 'GET',
      options?: { contentType?: string },
    ) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          presignedUrlCalls: [
            ...current.presignedUrlCalls,
            {
              bucket,
              key,
              method,
              contentType: options?.contentType ?? 'image/jpeg',
            },
          ],
        }))
        return state.presignedUrl
      }),
  } as unknown as S3Service['Service'])

  const submissionsRepository = SubmissionsRepository.of({
      createSubmission: ({ data }: { data: Record<string, unknown> }) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          submissionCreates: [
            ...state.submissionCreates,
            {
              participantId: data.participantId as number,
              key: data.key as string,
              marathonId: data.marathonId as number,
              topicId: data.topicId as number,
            },
          ],
        })).pipe(Effect.as(undefined)),
  } as unknown as SubmissionsRepository['Service'])

  const uploadKv = UploadSessionRepository.of({
    initializeState: (
      initDomain: string,
      initReference: string,
      uploadSessionId: string,
      keys: readonly string[],
    ) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        kvInitializeCalls: [
          ...state.kvInitializeCalls,
          { domain: initDomain, reference: initReference, uploadSessionId, keys },
        ],
      })).pipe(Effect.as(undefined)),
  } as unknown as UploadSessionRepository['Service'])

  return UploadProvisionerServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ExifKVRepository)(exifKv),
        Layer.succeed(S3Service)(s3),
        Layer.succeed(SubmissionsRepository)(submissionsRepository),
        Layer.succeed(UploadSessionRepository)(uploadKv),
        configLayerFromEnv({ SUBMISSIONS_BUCKET_NAME: 'submissions-bucket' }),
      ),
    ),
  )
}

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, UploadProvisionerService>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(makeTestLayer(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

describe('UploadProvisionerService', () => {
  it.effect('resetAndSeedUploadExif merges stale and current indexes for deletion', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const provisioner = yield* UploadProvisionerService
          yield* provisioner.resetAndSeedUploadExif({
            domain,
            reference,
            staleOrderIndexes: [0, 2],
            orderIndexes: [2, 3],
            uploadExif: [{ Make: 'Nikon' }],
          })
        }),
      )

      assert.deepStrictEqual(state.exifDeletes, [
        {
          domain,
          reference,
          orderIndexes: [0, 2, 3],
        },
      ])
      assert.deepStrictEqual(state.exifSets, [
        {
          domain,
          reference,
          orderIndex: 2,
          exif: { Make: 'Nikon' },
        },
      ])
    }),
  )

  it.effect('resetAndSeedUploadExif skips seeding when uploadExif is undefined', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const provisioner = yield* UploadProvisionerService
          yield* provisioner.resetAndSeedUploadExif({
            domain,
            reference,
            staleOrderIndexes: [1],
            orderIndexes: [2],
          })
        }),
      )

      assert.deepStrictEqual(state.exifDeletes, [
        { domain, reference, orderIndexes: [1, 2] },
      ])
      assert.deepStrictEqual(state.exifSets, [])
    }),
  )

  it.effect('provisionSingleByCameraUpload runs the full provisioning pipeline', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const provisioner = yield* UploadProvisionerService
          return yield* provisioner.provisionSingleByCameraUpload({
            domain,
            reference,
            participantId: 42,
            marathonId: 1,
            activeTopic: {
              id: 10,
              orderIndex,
            } as Parameters<
              UploadProvisionerService['Service']['provisionSingleByCameraUpload']
            >[0]['activeTopic'],
            resolvedContentType: 'image/jpeg',
            staleOrderIndexes: [0],
            uploadExif: [{ ISO: 200 }],
          })
        }),
      )

      assert.strictEqual(result.participantId, 42)
      assert.strictEqual(result.reference, reference)
      assert.match(result.uploadSessionId, /^[0-9a-f-]{36}$/i)
      assert.deepStrictEqual(result.uploads, [
        {
          key: submissionKey,
          url: 'https://example.com/presigned',
          contentType: 'image/jpeg',
        },
      ])
      assert.deepStrictEqual(state.submissionCreates, [
        {
          participantId: 42,
          key: submissionKey,
          marathonId: 1,
          topicId: 10,
        },
      ])
      assert.lengthOf(state.kvInitializeCalls, 1)
      assert.deepStrictEqual(state.kvInitializeCalls[0]?.keys, [submissionKey])
      assert.deepStrictEqual(state.presignedUrlCalls, [
        {
          bucket: 'submissions-bucket',
          key: submissionKey,
          method: 'PUT',
          contentType: 'image/jpeg',
        },
      ])
    }),
  )
})
