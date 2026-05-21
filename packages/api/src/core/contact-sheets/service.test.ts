import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import {
  ContactSheetsRepository,
  ParticipantsRepository,
  SponsorsRepository,
  TopicsRepository,
  type CompetitionClass,
} from '@blikka/db'
import { ContactSheetBuilder } from '@blikka/image-manipulation'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { BadRequestError, NotFoundError } from '../errors'
import { ContactSheetsService, ContactSheetsServiceLayerNoDeps } from './service'

const domain = 'demo'
const reference = '1001'

interface TestState {
  readonly participant:
    | {
        id: number
        marathonId: number
        reference: string
        submissions: ReadonlyArray<{ key: string }>
        competitionClass: CompetitionClass | null
      }
    | undefined
  readonly savedContactSheets: ReadonlyArray<Record<string, unknown>>
}

const makeCompetitionClass = (numberOfPhotos: number): CompetitionClass =>
  ({
    id: 10,
    marathonId: 1,
    name: 'Open',
    description: null,
    numberOfPhotos,
    topicStartIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }) as CompetitionClass

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  participant: {
    id: 1,
    marathonId: 1,
    reference,
    competitionClass: makeCompetitionClass(8),
    submissions: Array.from({ length: 8 }, (_, index) => ({
      key: `${domain}/${reference}/${String(index + 1).padStart(2, '0')}/original.jpg`,
    })),
  },
  savedContactSheets: [],
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
    getLatestSponsorByType: () => Effect.succeed(Option.none()),
  } as unknown as SponsorsRepository['Service'])

  const topicsRepository = TopicsRepository.of({
    getTopicsByDomain: () => Effect.succeed([]),
  } as unknown as TopicsRepository['Service'])

  const contactSheetsRepository = ContactSheetsRepository.of({
    save: ({ data }: { data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        savedContactSheets: [...state.savedContactSheets, data],
      })).pipe(Effect.as(undefined)),
  } as unknown as ContactSheetsRepository['Service'])

  const s3Service = S3Service.of({
    getFile: () => Effect.succeed(Option.some(Buffer.from('image-bytes'))),
    putFile: () => Effect.void,
  } as unknown as S3Service['Service'])

  const contactSheetBuilder = ContactSheetBuilder.of({
    createSheet: () => Effect.succeed(Buffer.from('contact-sheet')),
  } as unknown as ContactSheetBuilder['Service'])

  return ContactSheetsServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(SponsorsRepository)(sponsorsRepository),
        Layer.succeed(TopicsRepository)(topicsRepository),
        Layer.succeed(ContactSheetsRepository)(contactSheetsRepository),
        Layer.succeed(S3Service)(s3Service),
        Layer.succeed(ContactSheetBuilder)(contactSheetBuilder),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, ContactSheetsService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(
      configLayerFromEnv({
        CONTACT_SHEETS_BUCKET_NAME: 'contact-sheets-bucket',
        SUBMISSIONS_BUCKET_NAME: 'submissions-bucket',
        SPONSORS_BUCKET_NAME: 'sponsors-bucket',
      }),
    ),
  )

describe('ContactSheetsService', () => {
  it.effect('generates and persists a contact sheet when submissions match class photo count', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ContactSheetsService
          return yield* service.generateContactSheet({
            domain,
            reference,
          })
        }),
      )

      assert.equal(result.success, true)
      assert.match(result.key, new RegExp(`^${domain}/${reference}/contact_sheet_`))
      assert.equal(state.savedContactSheets[0]?.participantId, 1)
      assert.equal(state.savedContactSheets[0]?.marathonId, 1)
    }),
  )

  it.effect('fails when participant has no submissions', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          participant: {
            id: 1,
            marathonId: 1,
            reference,
            competitionClass: makeCompetitionClass(8),
            submissions: [],
          },
        }),
      )

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ContactSheetsService
          return yield* Effect.flip(
            service.generateContactSheet({
              domain,
              reference,
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, BadRequestError)
      assert.match(error.message, /no submissions/i)
    }),
  )

  it.effect('fails when submission count does not match competition class photo count', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          participant: {
            id: 1,
            marathonId: 1,
            reference,
            competitionClass: makeCompetitionClass(8),
            submissions: [{ key: `${domain}/${reference}/01/original.jpg` }],
          },
        }),
      )

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ContactSheetsService
          return yield* Effect.flip(
            service.generateContactSheet({
              domain,
              reference,
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, BadRequestError)
      assert.match(error.message, /Photo count mismatch/)
    }),
  )

  it.effect('fails when participant is not found', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ participant: undefined }))

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ContactSheetsService
          return yield* Effect.flip(
            service.generateContactSheet({
              domain,
              reference,
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, NotFoundError)
    }),
  )
})
