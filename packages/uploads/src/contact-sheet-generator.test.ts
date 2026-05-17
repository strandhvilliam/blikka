import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import {
  ContactSheetsRepository,
  ParticipantsRepository,
  SponsorsRepository,
  TopicsRepository,
} from '@blikka/db'
import type { CompetitionClass } from '@blikka/db'
import { ContactSheetBuilder, type ContactSheetImageFile } from '@blikka/image-manipulation'
import { type ParticipantState, UploadSessionRepository } from '@blikka/kv-store'
import { Effect, Layer, Option, Ref } from 'effect'

import { UploadsConfig } from './config'
import {
  ContactSheetGenerator,
  ContactSheetGeneratorLayerNoDeps,
  FailedToGenerateContactSheetError,
  InvalidSheetGenerationDataError,
  type GenerateContactSheetInput,
} from './contact-sheet-generator'

const uploadSessionId = 'upload-session-1'
const input: GenerateContactSheetInput = {
  domain: 'demo',
  reference: 'REF123',
  uploadSessionId,
}

const sheetBytes = Buffer.from([1, 2, 3])
const topics = [
  { name: 'Topic 1', orderIndex: 0 },
  { name: 'Topic 2', orderIndex: 1 },
]

const makeParticipantState = (overrides: Partial<ParticipantState> = {}): ParticipantState => ({
  uploadSessionId,
  expectedCount: 8,
  orderIndexes: [0, 1, 2, 3, 4, 5, 6, 7],
  processedIndexes: [0, 1, 2, 3, 4, 5, 6, 7],
  validated: true,
  zipKey: '',
  contactSheetKey: '',
  errors: [],
  finalized: true,
  checkedAt: null,
  ...overrides,
})

const makeCompetitionClass = (overrides: Partial<CompetitionClass> = {}): CompetitionClass =>
  ({
    id: 1,
    numberOfPhotos: 8,
    ...overrides,
  }) as CompetitionClass

const submissionKeys = Array.from(
  { length: 8 },
  (_, index) => `demo/REF123/${String(index + 1).padStart(2, '0')}/photo.jpg`,
)
const submissionFiles = submissionKeys.map((_, index) => Buffer.from(`submission-${index}`))
const sponsorKey = 'sponsors/contact-sheet-logo.png'
const sponsorBytes = Buffer.from('sponsor')

const createFileMap = (entries: ReadonlyArray<readonly [string, string, Uint8Array]>) =>
  new Map(entries.map(([bucket, key, file]) => [`${bucket}/${key}`, file] as const))

interface TestState {
  readonly participantState: ParticipantState | undefined
  readonly participant:
    | {
        readonly id: number
        readonly marathonId: number
        readonly competitionClass: CompetitionClass | null
        readonly submissions: ReadonlyArray<{ key: string }>
      }
    | undefined
  readonly sponsor: { readonly key: string } | undefined
  readonly topics: ReadonlyArray<{ name: string; orderIndex: number }>
  readonly builderResult: Effect.Effect<Buffer, Error>
  readonly sheetInputs: ReadonlyArray<{
    reference: string
    images: ReadonlyArray<ContactSheetImageFile>
    sponsorImage?: Buffer | Uint8Array
    sponsorPosition: 'bottom-right'
    topics: ReadonlyArray<{ name: string; orderIndex: number }>
  }>
  readonly files: ReadonlyMap<string, Uint8Array>
  readonly filePuts: ReadonlyArray<{
    bucket: string
    key: string
    file: Buffer
  }>
  readonly participantUpdates: ReadonlyArray<Partial<ParticipantState>>
  readonly contactSheetWrites: ReadonlyArray<{
    key: string
    participantId: number
    marathonId: number
  }>
}

type S3PutFileOutput = Effect.Success<ReturnType<S3Service['Service']['putFile']>>

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  participantState: makeParticipantState(),
  participant: {
    id: 123,
    marathonId: 456,
    competitionClass: makeCompetitionClass(),
    submissions: submissionKeys.map((key) => ({ key })),
  },
  sponsor: { key: sponsorKey },
  topics,
  builderResult: Effect.succeed(sheetBytes),
  sheetInputs: [],
  files: createFileMap([
    ...submissionKeys.map(
      (key, index) => ['submissions', key, submissionFiles[index] as Uint8Array] as const,
    ),
    ['sponsors', sponsorKey, sponsorBytes],
  ]),
  filePuts: [],
  participantUpdates: [],
  contactSheetWrites: [],
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const participantsRepository = ParticipantsRepository.of({
    getParticipantByReference: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.participant)
      }),
  } as unknown as ParticipantsRepository['Service'])

  const sponsorsRepository = SponsorsRepository.of({
    getLatestSponsorByType: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.sponsor)
      }),
  } as unknown as SponsorsRepository['Service'])

  const topicsRepository = TopicsRepository.of({
    getTopicsByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return [...state.topics]
      }),
  } as unknown as TopicsRepository['Service'])

  const contactSheetsRepository = ContactSheetsRepository.of({
    save: ({ data }: { data: { key: string; participantId: number; marathonId: number } }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        contactSheetWrites: [...state.contactSheetWrites, data],
      })).pipe(Effect.as(data)),
  } as unknown as ContactSheetsRepository['Service'])

  const uploadKv = UploadSessionRepository.of({
    getParticipantState: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.participantState)
      }),
    updateParticipantSession: (
      _domain: string,
      _reference: string,
      participantState: Partial<ParticipantState>,
    ) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        participantUpdates: [...state.participantUpdates, participantState],
      })).pipe(Effect.as(1)),
  } as unknown as UploadSessionRepository['Service'])

  const s3 = S3Service.of({
    getFile: (bucket: string, key: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.files.get(`${bucket}/${key}`))
      }),
    putFile: (bucket: string, key: string, file: Buffer) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        filePuts: [...state.filePuts, { bucket, key, file }],
      })).pipe(Effect.as({} as S3PutFileOutput)),
  } as unknown as S3Service['Service'])

  const contactSheetBuilder = ContactSheetBuilder.of({
    createSheet: (params: {
      reference: string
      images: ReadonlyArray<ContactSheetImageFile>
      sponsorImage?: Buffer | Uint8Array
      sponsorPosition: 'bottom-right'
      topics: ReadonlyArray<{ name: string; orderIndex: number }>
    }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          sheetInputs: [...current.sheetInputs, params],
        }))
        return yield* state.builderResult
      }),
  } as unknown as ContactSheetBuilder['Service'])

  return ContactSheetGeneratorLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(SponsorsRepository)(sponsorsRepository),
        Layer.succeed(TopicsRepository)(topicsRepository),
        Layer.succeed(ContactSheetsRepository)(contactSheetsRepository),
        Layer.succeed(UploadSessionRepository)(uploadKv),
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
        Layer.succeed(ContactSheetBuilder)(contactSheetBuilder),
      ),
    ),
  )
}

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, ContactSheetGenerator>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(makeTestLayer(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

describe('ContactSheetGenerator', () => {
  it.effect('generates and records a contact sheet for a current multi-photo participant', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const generator = yield* ContactSheetGenerator
          yield* generator.generate(input)
        }),
      )

      assert.deepStrictEqual(state.sheetInputs, [
        {
          reference: input.reference,
          images: submissionFiles.map((buffer, orderIndex) => ({
            orderIndex,
            buffer,
          })),
          sponsorImage: sponsorBytes,
          sponsorPosition: 'bottom-right',
          topics,
        },
      ])
      assert.lengthOf(state.filePuts, 1)
      assert.strictEqual(state.filePuts[0]?.bucket, 'contact-sheets')
      assert.match(
        state.filePuts[0]?.key ?? '',
        /^demo\/REF123\/contact_sheet_REF123_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.jpg$/,
      )
      assert.strictEqual(state.filePuts[0]?.file, sheetBytes)
      assert.deepStrictEqual(state.participantUpdates, [
        { contactSheetKey: state.filePuts[0]?.key },
      ])
      assert.deepStrictEqual(state.contactSheetWrites, [
        {
          key: state.filePuts[0]?.key ?? '',
          participantId: 123,
          marathonId: 456,
        },
      ])
    }),
  )

  it.effect('generates without a sponsor when no contact-sheet sponsor exists', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState({ sponsor: undefined }), () =>
        Effect.gen(function* () {
          const generator = yield* ContactSheetGenerator
          yield* generator.generate(input)
        }),
      )

      assert.strictEqual(state.sheetInputs[0]?.sponsorImage, undefined)
      assert.lengthOf(state.filePuts, 1)
    }),
  )

  it.effect('skips stale upload-session events', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          participantState: makeParticipantState({
            uploadSessionId: 'new-upload-session',
          }),
        }),
        () =>
          Effect.gen(function* () {
            const generator = yield* ContactSheetGenerator
            yield* generator.generate(input)
          }),
      )

      assert.deepStrictEqual(state.sheetInputs, [])
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.participantUpdates, [])
      assert.deepStrictEqual(state.contactSheetWrites, [])
    }),
  )

  it.effect('skips participants that already have a contact sheet', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          participantState: makeParticipantState({
            contactSheetKey: 'existing-sheet.jpg',
          }),
        }),
        () =>
          Effect.gen(function* () {
            const generator = yield* ContactSheetGenerator
            yield* generator.generate(input)
          }),
      )

      assert.deepStrictEqual(state.sheetInputs, [])
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.participantUpdates, [])
      assert.deepStrictEqual(state.contactSheetWrites, [])
    }),
  )

  it.effect('skips single-photo participants', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          participantState: makeParticipantState({ expectedCount: 1 }),
        }),
        () =>
          Effect.gen(function* () {
            const generator = yield* ContactSheetGenerator
            yield* generator.generate(input)
          }),
      )

      assert.deepStrictEqual(state.sheetInputs, [])
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.participantUpdates, [])
      assert.deepStrictEqual(state.contactSheetWrites, [])
    }),
  )

  it.effect('fails when participant state is missing', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({ participantState: undefined }),
        () =>
          Effect.gen(function* () {
            const generator = yield* ContactSheetGenerator
            return yield* Effect.flip(generator.generate(input))
          }),
      )

      assert.instanceOf(error, InvalidSheetGenerationDataError)
      assert.strictEqual(error.message, 'Participant state not found')
      assert.deepStrictEqual(state.sheetInputs, [])
      assert.deepStrictEqual(state.filePuts, [])
    }),
  )

  it.effect('fails when participant is missing', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({ participant: undefined }),
        () =>
          Effect.gen(function* () {
            const generator = yield* ContactSheetGenerator
            return yield* Effect.flip(generator.generate(input))
          }),
      )

      assert.instanceOf(error, InvalidSheetGenerationDataError)
      assert.strictEqual(error.message, 'Participant not found')
      assert.deepStrictEqual(state.sheetInputs, [])
      assert.deepStrictEqual(state.filePuts, [])
    }),
  )

  it.effect('fails when competition class photo count is unsupported', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          participant: {
            id: 123,
            marathonId: 456,
            competitionClass: makeCompetitionClass({ numberOfPhotos: 12 }),
            submissions: submissionKeys.slice(0, 12).map((key) => ({ key })),
          },
        }),
        () =>
          Effect.gen(function* () {
            const generator = yield* ContactSheetGenerator
            return yield* Effect.flip(generator.generate(input))
          }),
      )

      assert.instanceOf(error, InvalidSheetGenerationDataError)
      assert.strictEqual(error.message, 'Unsupported photo count 12 for participant REF123')
      assert.deepStrictEqual(state.sheetInputs, [])
      assert.deepStrictEqual(state.filePuts, [])
    }),
  )

  it.effect('fails when submission count does not match competition class', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          participant: {
            id: 123,
            marathonId: 456,
            competitionClass: makeCompetitionClass({ numberOfPhotos: 8 }),
            submissions: submissionKeys.slice(0, 7).map((key) => ({ key })),
          },
        }),
        () =>
          Effect.gen(function* () {
            const generator = yield* ContactSheetGenerator
            return yield* Effect.flip(generator.generate(input))
          }),
      )

      assert.instanceOf(error, InvalidSheetGenerationDataError)
      assert.strictEqual(error.message, 'Photo count mismatch. Expected 8, got 7')
      assert.deepStrictEqual(state.sheetInputs, [])
      assert.deepStrictEqual(state.filePuts, [])
    }),
  )

  it.effect('fails before builder call when a submission file is missing', () =>
    Effect.gen(function* () {
      const files = new Map(makeInitialState().files)
      files.delete(`submissions/${submissionKeys[0]}`)

      const { result: error, state } = yield* runWithState(makeInitialState({ files }), () =>
        Effect.gen(function* () {
          const generator = yield* ContactSheetGenerator
          return yield* Effect.flip(generator.generate(input))
        }),
      )

      assert.instanceOf(error, InvalidSheetGenerationDataError)
      assert.strictEqual(error.message, `Submission image not found: ${submissionKeys[0]}`)
      assert.deepStrictEqual(state.sheetInputs, [])
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.participantUpdates, [])
      assert.deepStrictEqual(state.contactSheetWrites, [])
    }),
  )

  it.effect('fails before builder call when a sponsor file is missing', () =>
    Effect.gen(function* () {
      const files = new Map(makeInitialState().files)
      files.delete(`sponsors/${sponsorKey}`)

      const { result: error, state } = yield* runWithState(makeInitialState({ files }), () =>
        Effect.gen(function* () {
          const generator = yield* ContactSheetGenerator
          return yield* Effect.flip(generator.generate(input))
        }),
      )

      assert.instanceOf(error, InvalidSheetGenerationDataError)
      assert.strictEqual(error.message, `Sponsor image not found: ${sponsorKey}`)
      assert.deepStrictEqual(state.sheetInputs, [])
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.participantUpdates, [])
      assert.deepStrictEqual(state.contactSheetWrites, [])
    }),
  )

  it.effect('maps builder failures into FailedToGenerateContactSheetError', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          builderResult: Effect.fail(new Error('sharp failed')),
        }),
        () =>
          Effect.gen(function* () {
            const generator = yield* ContactSheetGenerator
            return yield* Effect.flip(generator.generate(input))
          }),
      )

      assert.instanceOf(error, FailedToGenerateContactSheetError)
      assert.strictEqual(error.message, 'Failed to generate contact sheet: sharp failed')
      assert.lengthOf(state.sheetInputs, 1)
      assert.deepStrictEqual(state.filePuts, [])
      assert.deepStrictEqual(state.participantUpdates, [])
      assert.deepStrictEqual(state.contactSheetWrites, [])
    }),
  )
})
