import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import {
  ParticipantsRepository,
  SubmissionsRepository,
  TopicsRepository,
  type Submission,
} from '@blikka/db'
import { ExifParser, SharpImageService } from '@blikka/image-manipulation'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { ValidationsService } from '../validations/service'
import { AdminReplaceSubmissionError } from './replace-submission'
import { SubmissionsService, SubmissionsServiceLayerNoDeps } from './service'

const domain = 'demo'
const submissionId = 10

interface TestState {
  readonly submission: Submission | undefined
  readonly participant: { id: number; domain: string; reference: string } | undefined
  readonly topic: { id: number; orderIndex: number } | undefined
}

const makeSubmission = (overrides: Partial<Submission> = {}): Submission =>
  ({
    id: submissionId,
    participantId: 1,
    topicId: 1,
    key: `${domain}/1001/01/original.jpg`,
    thumbnailKey: `${domain}/1001/01/thumb.jpg`,
    previewKey: null,
    status: 'uploaded',
    exif: {},
    size: 1000,
    mimeType: 'image/jpeg',
    ...overrides,
  }) as Submission

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  submission: makeSubmission(),
  participant: { id: 1, domain, reference: '1001' },
  topic: { id: 1, orderIndex: 1 },
  ...overrides,
})

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const submissionsRepository = SubmissionsRepository.of({
    getSubmissionById: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.submission)
      }),
    updateSubmissionById: () => Effect.void,
  } as unknown as SubmissionsRepository['Service'])

  const participantsRepository = ParticipantsRepository.of({
    getParticipantById: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.participant)
      }),
  } as unknown as ParticipantsRepository['Service'])

  const topicsRepository = TopicsRepository.of({
    getTopicById: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.topic ?? null
      }),
  } as unknown as TopicsRepository['Service'])

  const s3Service = S3Service.of({
    generateSubmissionKey: () => Effect.succeed(`${domain}/1001/01/replace.jpg`),
    getPresignedUrl: () => Effect.succeed('https://example.com/upload'),
    getHead: () => Effect.succeed({ ContentLength: 1000, ContentType: 'image/jpeg' }),
    getFile: () => Effect.succeed(Option.some(Buffer.from('image-bytes'))),
    putFile: () => Effect.void,
    deleteFile: () => Effect.void,
  } as unknown as S3Service['Service'])

  const exifParser = ExifParser.of({
    parse: () => Effect.succeed({ Make: 'Test Camera' }),
  } as unknown as ExifParser['Service'])

  const sharp = SharpImageService.of({
    resize: () => Effect.succeed(Buffer.from('thumb-bytes')),
  } as unknown as SharpImageService['Service'])

  const validationsService = ValidationsService.of({
    runValidations: () => Effect.succeed({ success: true, resultsCount: 2 }),
  } as unknown as ValidationsService['Service'])

  return SubmissionsServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(SubmissionsRepository)(submissionsRepository),
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(TopicsRepository)(topicsRepository),
        Layer.succeed(S3Service)(s3Service),
        Layer.succeed(ExifParser)(exifParser),
        Layer.succeed(SharpImageService)(sharp),
        Layer.succeed(ValidationsService)(validationsService),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, SubmissionsService>,
) =>
  effect.pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(
      configLayerFromEnv({
        SUBMISSIONS_BUCKET_NAME: 'submissions-bucket',
        THUMBNAILS_BUCKET_NAME: 'thumbnails-bucket',
      }),
    ),
  )

describe('SubmissionsService', () => {
  it.effect('requires admin access to begin replacement upload', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const error = yield* Effect.flip(
        runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* SubmissionsService
            return yield* service.beginAdminReplaceUpload({
              domain,
              submissionId,
              contentType: 'image/jpeg',
              isAdminForDomain: false,
            })
          }),
        ),
      )

      assert.instanceOf(error, AdminReplaceSubmissionError)
      assert.match(error.message, /Admin access is required/)
    }),
  )

  it.effect('returns presigned upload details for admins', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* SubmissionsService
          return yield* service.beginAdminReplaceUpload({
            domain,
            submissionId,
            contentType: 'image/jpeg',
            isAdminForDomain: true,
          })
        }),
      )

      assert.equal(result.contentType, 'image/jpeg')
      assert.equal(result.previousKey, `${domain}/1001/01/original.jpg`)
      assert.equal(result.presignedPutUrl, 'https://example.com/upload')
    }),
  )

  it.effect('fails when submission is missing', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ submission: undefined }))

      const error = yield* Effect.flip(
        runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* SubmissionsService
            return yield* service.beginAdminReplaceUpload({
              domain,
              submissionId,
              contentType: 'image/jpeg',
              isAdminForDomain: true,
            })
          }),
        ),
      )

      assert.instanceOf(error, AdminReplaceSubmissionError)
      assert.match(error.message, /Submission not found/)
    }),
  )

  it.effect('rejects replacement when submission domain does not match', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          participant: { id: 1, domain: 'other', reference: '1001' },
        }),
      )

      const error = yield* Effect.flip(
        runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* SubmissionsService
            return yield* service.beginAdminReplaceUpload({
              domain,
              submissionId,
              contentType: 'image/jpeg',
              isAdminForDomain: true,
            })
          }),
        ),
      )

      assert.instanceOf(error, AdminReplaceSubmissionError)
      assert.match(error.message, /does not belong to this domain/)
    }),
  )
})
