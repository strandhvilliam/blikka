import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import {
  ParticipantsRepository,
  SubmissionsRepository,
  TopicsRepository,
  type Participant,
  type Submission,
  type Topic,
  type ZippedSubmission,
} from '@blikka/db'
import { Effect, Layer, Option, Ref } from 'effect'
import JSZip from 'jszip'

import { UploadsConfig } from './config'
import {
  EnsureParticipantZip,
  EnsureParticipantZipLayerNoDeps,
  FailedToGenerateZipError,
  ZipWorkerDataNotFoundError,
  type EnsureParticipantZipInput,
} from './ensure-participant-zip'

const input: EnsureParticipantZipInput = {
  domain: 'demo',
  reference: 'REF123',
}

const ZIP_KEY = 'demo/REF123.zip'

const firstPhoto = Uint8Array.from([1, 2, 3])
const secondPhoto = Uint8Array.from([4, 5, 6])

const submissions = [
  { id: 11, key: 'demo/REF123/01/photo.jpg', topicId: 101 },
  { id: 12, key: 'demo/REF123/02/photo.png', topicId: 102 },
] as unknown as readonly Submission[]

const topics = [
  { id: 101, orderIndex: 0 },
  { id: 102, orderIndex: 1 },
] as unknown as readonly Topic[]

const makeParticipant = (zippedSubmissions: readonly ZippedSubmission[] = []) =>
  ({
    id: 123,
    marathonId: 456,
    reference: input.reference,
    submissions,
    zippedSubmissions,
  }) as unknown as Participant

const cachedRow = { id: 1, key: ZIP_KEY, createdAt: null } as unknown as ZippedSubmission

interface TestState {
  readonly participant: Participant | undefined
  readonly topics: readonly Topic[]
  readonly files: Record<string, Uint8Array | undefined>
  readonly getFileResult: Effect.Effect<Option.Option<Uint8Array>, unknown> | undefined
  readonly putFileResult: Effect.Effect<S3PutFileOutput, unknown>
  /** When set, controls whether the zip object is reported present (Right) or missing (Left). */
  readonly headResult: Effect.Effect<S3HeadOutput, unknown> | undefined
  readonly createZippedSubmissionResult: Effect.Effect<undefined, unknown>
  readonly participantLookups: ReadonlyArray<{ domain: string; reference: string }>
  readonly topicLookups: ReadonlyArray<{ id: number }>
  readonly fileGets: ReadonlyArray<{ bucket: string; key: string }>
  readonly headGets: ReadonlyArray<{ bucket: string; key: string }>
  readonly filePuts: ReadonlyArray<{ bucket: string; key: string; file: Buffer }>
  readonly zippedSubmissionWrites: ReadonlyArray<{
    data: {
      marathonId: number
      participantId: number
      key: string
      exportType: 'zip'
      progress: number
      status: 'completed'
      errors: readonly string[]
    }
  }>
}

type S3PutFileOutput = Effect.Success<ReturnType<S3Service['Service']['putFile']>>
type S3HeadOutput = Effect.Success<ReturnType<S3Service['Service']['getHead']>>

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  participant: makeParticipant(),
  topics,
  files: {
    [submissions[0]!.key]: firstPhoto,
    [submissions[1]!.key]: secondPhoto,
  },
  getFileResult: undefined,
  putFileResult: Effect.succeed({} as S3PutFileOutput),
  headResult: undefined,
  createZippedSubmissionResult: Effect.succeed(undefined),
  participantLookups: [],
  topicLookups: [],
  fileGets: [],
  headGets: [],
  filePuts: [],
  zippedSubmissionWrites: [],
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const participantsRepository = ParticipantsRepository.of({
    getParticipantByReference: ({ domain, reference }: { domain: string; reference: string }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          participantLookups: [...current.participantLookups, { domain, reference }],
        }))
        return Option.fromNullishOr(state.participant)
      }),
  } as unknown as ParticipantsRepository['Service'])

  const topicsRepository = TopicsRepository.of({
    getTopicsByMarathonId: ({ id }: { id: number }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          topicLookups: [...current.topicLookups, { id }],
        }))
        return [...state.topics]
      }),
  } as unknown as TopicsRepository['Service'])

  const submissionsRepository = SubmissionsRepository.of({
    createZippedSubmission: (dto: TestState['zippedSubmissionWrites'][number]) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          zippedSubmissionWrites: [...current.zippedSubmissionWrites, dto],
        }))
        return yield* state.createZippedSubmissionResult
      }),
  } as unknown as SubmissionsRepository['Service'])

  const s3 = S3Service.of({
    getFile: (bucket: string, key: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          fileGets: [...current.fileGets, { bucket, key }],
        }))

        if (state.getFileResult !== undefined) {
          return yield* state.getFileResult
        }

        return Option.fromNullishOr(state.files[key])
      }),
    getHead: (bucket: string, key: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          headGets: [...current.headGets, { bucket, key }],
        }))
        return yield* state.headResult ?? Effect.succeed({} as S3HeadOutput)
      }),
    putFile: (bucket: string, key: string, file: Buffer) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          filePuts: [...current.filePuts, { bucket, key, file }],
        }))
        return yield* state.putFileResult
      }),
  } as unknown as S3Service['Service'])

  return EnsureParticipantZipLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(TopicsRepository)(topicsRepository),
        Layer.succeed(SubmissionsRepository)(submissionsRepository),
        Layer.succeed(S3Service)(s3),
        Layer.succeed(UploadsConfig)(
          UploadsConfig.of({
            submissionsBucketName: 'submissions',
            sponsorsBucketName: 'sponsors',
            thumbnailsBucketName: 'thumbnails',
            contactSheetsBucketName: 'contact-sheets',
            zipsBucketName: 'zips',
          }),
        ),
      ),
    ),
  )
}

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, EnsureParticipantZip>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(makeTestLayer(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

const ensure = () =>
  Effect.gen(function* () {
    const helper = yield* EnsureParticipantZip
    return yield* helper.ensureParticipantZip(input)
  })

const ensureFlipped = () =>
  Effect.gen(function* () {
    const helper = yield* EnsureParticipantZip
    return yield* Effect.flip(helper.ensureParticipantZip(input))
  })

describe('ensureParticipantZip', () => {
  it.effect('builds, uploads, and records a zip when no cache exists', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(makeInitialState(), ensure)

      assert.strictEqual(result.generated, true)
      assert.strictEqual(result.key, ZIP_KEY)

      // No existing row, so the cache existence (getHead) check is skipped.
      assert.deepStrictEqual(state.headGets, [])

      assert.lengthOf(state.filePuts, 1)
      assert.strictEqual(state.filePuts[0]?.bucket, 'zips')
      assert.strictEqual(state.filePuts[0]?.key, ZIP_KEY)

      const zip = yield* Effect.promise(() => JSZip.loadAsync(state.filePuts[0]!.file))
      const firstEntry = yield* Effect.promise(
        () =>
          zip.file('REF123_01.jpg')?.async('uint8array') ?? Promise.reject(new Error('missing')),
      )
      const secondEntry = yield* Effect.promise(
        () =>
          zip.file('REF123_02.png')?.async('uint8array') ?? Promise.reject(new Error('missing')),
      )
      assert.deepStrictEqual([...firstEntry], [...firstPhoto])
      assert.deepStrictEqual([...secondEntry], [...secondPhoto])

      assert.deepStrictEqual(state.fileGets, [
        { bucket: 'submissions', key: submissions[0]!.key },
        { bucket: 'submissions', key: submissions[1]!.key },
      ])
      assert.deepStrictEqual(state.zippedSubmissionWrites, [
        {
          data: {
            marathonId: 456,
            participantId: 123,
            key: ZIP_KEY,
            exportType: 'zip',
            progress: 100,
            status: 'completed',
            errors: [],
          },
        },
      ])
    }),
  )

  it.effect('reuses the cached zip when both the row and the object exist', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(
        makeInitialState({ participant: makeParticipant([cachedRow]) }),
        ensure,
      )

      assert.strictEqual(result.generated, false)
      assert.strictEqual(result.key, ZIP_KEY)
      assert.deepStrictEqual(state.headGets, [{ bucket: 'zips', key: ZIP_KEY }])
      assert.deepStrictEqual(state.fileGets, [])
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.zippedSubmissionWrites, [])
    }),
  )

  it.effect('rebuilds without duplicating the row when the object is missing', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(
        makeInitialState({
          participant: makeParticipant([cachedRow]),
          headResult: Effect.fail(new Error('not found')),
        }),
        ensure,
      )

      assert.strictEqual(result.generated, true)
      assert.deepStrictEqual(state.headGets, [{ bucket: 'zips', key: ZIP_KEY }])
      assert.lengthOf(state.filePuts, 1)
      // Row already existed, so no duplicate insert.
      assert.deepStrictEqual(state.zippedSubmissionWrites, [])
    }),
  )

  it.effect('fails when participant is missing', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({ participant: undefined }),
        ensureFlipped,
      )

      assert.instanceOf(error, ZipWorkerDataNotFoundError)
      assert.strictEqual(error.message, 'Participant not found')
      assert.deepStrictEqual(state.topicLookups, [])
      assert.deepStrictEqual(state.fileGets, [])
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.zippedSubmissionWrites, [])
    }),
  )

  it.effect('fails when a submission topic is missing', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({ topics: topics.slice(0, 1) }),
        ensureFlipped,
      )

      assert.instanceOf(error, ZipWorkerDataNotFoundError)
      assert.strictEqual(error.message, 'Topic not found')
      assert.strictEqual(error.key, submissions[1]!.key)
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.zippedSubmissionWrites, [])
    }),
  )

  it.effect('fails when a submission file is missing', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          files: {
            [submissions[0]!.key]: firstPhoto,
            [submissions[1]!.key]: undefined,
          },
        }),
        ensureFlipped,
      )

      assert.instanceOf(error, ZipWorkerDataNotFoundError)
      assert.strictEqual(error.message, 'File not found')
      assert.strictEqual(error.key, submissions[1]!.key)
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.zippedSubmissionWrites, [])
    }),
  )

  it.effect('maps s3 get failures into FailedToGenerateZipError', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          getFileResult: Effect.fail(new Error('s3 unavailable')),
        }),
        ensureFlipped,
      )

      assert.instanceOf(error, FailedToGenerateZipError)
      assert.strictEqual(error.message, 'Failed to get file from s3')
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.zippedSubmissionWrites, [])
    }),
  )

  it.effect('maps zipped submission write failures into FailedToGenerateZipError', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          createZippedSubmissionResult: Effect.fail(new Error('db unavailable')),
        }),
        ensureFlipped,
      )

      assert.instanceOf(error, FailedToGenerateZipError)
      assert.strictEqual(error.message, 'Failed to save zipped submission to db')
      assert.lengthOf(state.filePuts, 1)
      assert.lengthOf(state.zippedSubmissionWrites, 1)
    }),
  )
})
