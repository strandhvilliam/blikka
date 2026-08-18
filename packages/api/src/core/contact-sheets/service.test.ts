import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import { EmailService } from '@blikka/email'
import {
  ContactSheetsRepository,
  MarathonsRepository,
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
        firstname: string
        lastname: string
        email: string | null
        submissions: ReadonlyArray<{ key: string; topic: { orderIndex: number } }>
        competitionClass: CompetitionClass | null
        contactSheets: ReadonlyArray<{ key: string; createdAt: string }>
      }
    | undefined
  readonly marathon: { readonly contactSheetFormat: string; readonly name: string; readonly logoUrl: string | null } | undefined
  readonly savedContactSheets: ReadonlyArray<Record<string, unknown>>
  readonly sheetInputs: ReadonlyArray<{ format?: 'classic' | 'a3' }>
  readonly sentEmails: ReadonlyArray<{ to: string; subject: string }>
  readonly emailSendShouldFail: boolean
}

/** Submission rows as the participant query returns them: a key plus the topic that orders it. */
const makeSubmissions = (count: number) =>
  Array.from({ length: count }, (_, orderIndex) => ({
    key: `${domain}/${reference}/${String(orderIndex + 1).padStart(2, '0')}/original.jpg`,
    topic: { orderIndex },
  }))

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
    firstname: 'Jane',
    lastname: 'Doe',
    email: 'jane@example.com',
    competitionClass: makeCompetitionClass(8),
    submissions: makeSubmissions(8),
    contactSheets: [],
  },
  marathon: { contactSheetFormat: 'classic', name: 'Demo Marathon', logoUrl: null },
  savedContactSheets: [],
  sheetInputs: [],
  sentEmails: [],
  emailSendShouldFail: false,
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

  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.marathon)
      }),
  } as unknown as MarathonsRepository['Service'])

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
    createSheet: (params: { format?: 'classic' | 'a3' }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        sheetInputs: [...state.sheetInputs, { format: params.format }],
      })).pipe(Effect.as(Buffer.from('contact-sheet'))),
  } as unknown as ContactSheetBuilder['Service'])

  const emailService = EmailService.of({
    send: (input: { to: string; subject: string }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (state.emailSendShouldFail) {
          return yield* Effect.fail(new Error('resend rejected email'))
        }
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          sentEmails: [...current.sentEmails, { to: input.to, subject: input.subject }],
        }))
        return { id: 'email-1' }
      }),
    sendBatch: () => Effect.die('not used in contact sheet tests'),
  } as unknown as EmailService['Service'])

  return ContactSheetsServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(SponsorsRepository)(sponsorsRepository),
        Layer.succeed(TopicsRepository)(topicsRepository),
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(ContactSheetsRepository)(contactSheetsRepository),
        Layer.succeed(S3Service)(s3Service),
        Layer.succeed(ContactSheetBuilder)(contactSheetBuilder),
        Layer.succeed(EmailService)(emailService),
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
      assert.strictEqual(state.sheetInputs[0]?.format, 'classic')
    }),
  )

  it.effect('uses marathon contact sheet format when generating', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({ marathon: { contactSheetFormat: 'a3', name: 'Demo Marathon', logoUrl: null } }),
      )

      const { state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ContactSheetsService
          return yield* service.generateContactSheet({
            domain,
            reference,
          })
        }),
      )

      assert.strictEqual(state.sheetInputs[0]?.format, 'a3')
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
            firstname: 'Jane',
            lastname: 'Doe',
            email: 'jane@example.com',
            competitionClass: makeCompetitionClass(8),
            submissions: [],
            contactSheets: [],
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
            firstname: 'Jane',
            lastname: 'Doe',
            email: 'jane@example.com',
            competitionClass: makeCompetitionClass(8),
            submissions: makeSubmissions(1),
            contactSheets: [],
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

  describe('sendConfirmationEmail', () => {
    it.effect('sends the contact-sheet-ready email for the latest contact sheet', () =>
      Effect.gen(function* () {
        const stateRef = yield* Ref.make(
          makeInitialState({
            participant: {
              id: 1,
              marathonId: 1,
              reference,
              firstname: 'Jane',
              lastname: 'Doe',
              email: 'jane@example.com',
              competitionClass: makeCompetitionClass(8),
              submissions: makeSubmissions(8),
              contactSheets: [
                { key: 'older-sheet.jpg', createdAt: '2026-01-01T00:00:00.000Z' },
                { key: 'newest-sheet.jpg', createdAt: '2026-01-02T00:00:00.000Z' },
              ],
            },
          }),
        )

        const { result, state } = yield* runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* ContactSheetsService
            return yield* service.sendConfirmationEmail({ domain, reference })
          }),
        )

        assert.equal(result.success, true)
        assert.equal(state.sentEmails.length, 1)
        assert.equal(state.sentEmails[0]?.to, 'jane@example.com')
      }),
    )

    it.effect('fails when the participant has no contact sheet yet', () =>
      Effect.gen(function* () {
        const stateRef = yield* Ref.make(makeInitialState())

        const error = yield* runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* ContactSheetsService
            return yield* Effect.flip(service.sendConfirmationEmail({ domain, reference }))
          }),
        ).pipe(Effect.map(({ result }) => result))

        assert.instanceOf(error, BadRequestError)
        assert.match(error.message, /no contact sheet/i)
      }),
    )

    it.effect('fails when the participant has no email on file', () =>
      Effect.gen(function* () {
        const stateRef = yield* Ref.make(
          makeInitialState({
            participant: {
              id: 1,
              marathonId: 1,
              reference,
              firstname: 'Jane',
              lastname: 'Doe',
              email: null,
              competitionClass: makeCompetitionClass(8),
              submissions: makeSubmissions(8),
              contactSheets: [{ key: 'sheet.jpg', createdAt: '2026-01-01T00:00:00.000Z' }],
            },
          }),
        )

        const error = yield* runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* ContactSheetsService
            return yield* Effect.flip(service.sendConfirmationEmail({ domain, reference }))
          }),
        ).pipe(Effect.map(({ result }) => result))

        assert.instanceOf(error, BadRequestError)
        assert.match(error.message, /no email/i)
      }),
    )

    it.effect('fails when the participant is not found', () =>
      Effect.gen(function* () {
        const stateRef = yield* Ref.make(makeInitialState({ participant: undefined }))

        const error = yield* runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* ContactSheetsService
            return yield* Effect.flip(service.sendConfirmationEmail({ domain, reference }))
          }),
        ).pipe(Effect.map(({ result }) => result))

        assert.instanceOf(error, NotFoundError)
      }),
    )
  })
})
