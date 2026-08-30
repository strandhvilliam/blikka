import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import { ExportsRepository, MarathonsRepository } from '@blikka/db'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { BadRequestError, NotFoundError } from '../errors'
import {
  EncryptedPhoneNumber,
  PhoneNumberEncryptionService,
} from '../utils/phone-number-encryption'
import { makeMarathon } from '../test/fixtures/marathon'
import { makeTopic } from '../test/fixtures/topic'
import { ExportsService, ExportsServiceLayerNoDeps } from './service'

const domain = 'demo'

interface TestState {
  readonly marathon: ReturnType<typeof makeMarathon> | undefined
  readonly participants: ReadonlyArray<Record<string, unknown>>
  readonly byCameraParticipants: ReadonlyArray<Record<string, unknown>>
  readonly submissionFiles: ReadonlyArray<{
    key: string
    mimeType: string | null
    participant: { reference: string }
    id: number
  }>
  /** Keys the fake S3 has no object for, so the archive has something to report as missing. */
  readonly missingKeys: ReadonlyArray<string>
  readonly s3Reads: ReadonlyArray<string>
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: makeMarathon({
    domain,
    mode: 'by-camera',
    topics: [makeTopic({ id: 1, visibility: 'active' })],
  }),
  participants: [
    {
      reference: '1001',
      firstname: 'Jane',
      lastname: 'Doe',
      email: 'jane@example.com',
      status: 'verified',
      competitionClassName: 'Open',
      deviceGroupName: 'Mobile',
      createdAt: '2026-01-01T00:00:00.000Z',
      uploadCount: 1,
    },
  ],
  byCameraParticipants: [
    {
      reference: '1001',
      firstname: 'Jane',
      lastname: 'Doe',
      email: 'jane@example.com',
      status: 'verified',
      competitionClassName: 'Open',
      deviceGroupName: 'Mobile',
      createdAt: '2026-01-01T00:00:00.000Z',
      topicsParticipatedCount: 2,
      latestTopicName: 'Topic 1',
      latestUploadedAt: '2026-01-01T00:00:00.000Z',
      phoneEncrypted: EncryptedPhoneNumber('encrypted-phone'),
    },
  ],
  submissionFiles: [
    {
      id: 1,
      key: `${domain}/1001/01/original.jpg`,
      mimeType: 'image/jpeg',
      participant: { reference: '1001' },
    },
  ],
  missingKeys: [],
  s3Reads: [],
  ...overrides,
})

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomainWithOptions: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.marathon)
      }),
  } as unknown as MarathonsRepository['Service'])

  const exportsRepository = ExportsRepository.of({
    getParticipantsForExport: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.participants
      }),
    getParticipantsForExportByTopic: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.participants
      }),
    getParticipantsForExportByCameraAllTopics: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.byCameraParticipants
      }),
    getSubmissionsForExport: () => Effect.succeed([]),
    getSubmissionsForExportByTopic: () => Effect.succeed([]),
    getValidationResultsForExport: () => Effect.succeed([]),
    getValidationResultsForExportByTopic: () => Effect.succeed([]),
    getSubmissionFilesForTopicExport: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.submissionFiles
      }),
  } as unknown as ExportsRepository['Service'])

  const s3Service = S3Service.of({
    getFile: (bucket: string, key: string) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          s3Reads: [...state.s3Reads, `${bucket}:${key}`],
        }))
        const state = yield* Ref.get(stateRef)
        return state.missingKeys.includes(key)
          ? Option.none<Uint8Array>()
          : Option.some(Buffer.from('image-bytes'))
      }),
  } as unknown as S3Service['Service'])

  const phoneEncryption = PhoneNumberEncryptionService.of({
    decrypt: () => Effect.succeed('+4712345678'),
    encrypt: () => Effect.die('not used'),
    hashLookup: () => Effect.die('not used'),
  } as unknown as PhoneNumberEncryptionService['Service'])

  return ExportsServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(ExportsRepository)(exportsRepository),
        Layer.succeed(S3Service)(s3Service),
        Layer.succeed(PhoneNumberEncryptionService)(phoneEncryption),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, ExportsService>,
) =>
  effect.pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(
      configLayerFromEnv({
        SUBMISSIONS_BUCKET_NAME: 'submissions-bucket',
        THUMBNAILS_BUCKET_NAME: 'thumbnails-bucket',
        CONTACT_SHEETS_BUCKET_NAME: 'contact-sheets-bucket',
      }),
    ),
  )

describe('ExportsService', () => {
  it.effect('returns participant export rows for a domain', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ExportsService
          return yield* service.getParticipantsExportData({ domain })
        }),
      )

      assert.equal(result.length, 1)
      assert.equal(result[0]?.reference, '1001')
    }),
  )

  it.effect('decrypts phone numbers for by-camera all-topics participant export', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ExportsService
          return yield* service.getParticipantsExportDataByCameraAllTopics({ domain })
        }),
      )

      assert.equal(result[0]?.phoneNumber, '+4712345678')
      assert.notProperty(result[0] ?? {}, 'phoneEncrypted')
    }),
  )

  it.effect('rejects classic marathon exports for by-camera-only active topic queries', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          marathon: makeMarathon({ domain, mode: 'marathon' }),
        }),
      )

      const error = yield* Effect.flip(
        runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* ExportsService
            return yield* service.getParticipantsExportDataByCameraActiveTopic({ domain })
          }),
        ),
      )

      assert.instanceOf(error, BadRequestError)
    }),
  )

  it.effect('builds a zip archive for the active by-camera topic', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ExportsService
          return yield* service.buildByCameraActiveTopicImagesZip({ domain })
        }),
      )

      assert.equal(result.topicName, 'Topic 1')
      assert.isTrue(result.zipBuffer.length > 0)
    }),
  )

  it.effect('fails image archive export when marathon is missing', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ marathon: undefined }))

      const error = yield* Effect.flip(
        runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* ExportsService
            return yield* service.buildByCameraActiveTopicImagesZip({ domain })
          }),
        ),
      )

      assert.instanceOf(error, NotFoundError)
    }),
  )

  it.effect('fetches an object once however many archive paths point at it', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ExportsService
          return yield* service.buildImageArchive({
            files: [
              { bucket: 'submissions', key: 'a.jpg', path: 'root/ada/01-winner-0001.jpg' },
              { bucket: 'submissions', key: 'a.jpg', path: 'root/bo/01-winner-0001.jpg' },
              { bucket: 'contact-sheets', key: 'b.png', path: 'root/bo/02-shortlist-0002.png' },
            ],
            textFiles: [{ path: 'root/README.txt', content: 'readme' }],
          })
        }),
      )

      const state = yield* Ref.get(stateRef)

      assert.deepEqual(state.s3Reads, ['submissions-bucket:a.jpg', 'contact-sheets-bucket:b.png'])
      assert.deepEqual(result.missingPaths, [])
      assert.isTrue(result.zipBuffer.length > 0)
    }),
  )

  it.effect('keeps the archive when an object is gone and lists what it could not read', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ missingKeys: ['gone.jpg'] }))

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ExportsService
          return yield* service.buildImageArchive({
            files: [
              { bucket: 'submissions', key: 'a.jpg', path: 'root/ada/01-winner-0001.jpg' },
              { bucket: 'submissions', key: 'gone.jpg', path: 'root/ada/02-shortlist-0002.jpg' },
            ],
            missingManifestPath: 'root/missing-files.txt',
          })
        }),
      )

      assert.deepEqual(result.missingPaths, ['root/ada/02-shortlist-0002.jpg'])
      assert.isTrue(result.zipBuffer.length > 0)
    }),
  )
})
