import { assert, describe, it } from '@effect/vitest'
import { EmailService } from '@blikka/email'
import { MarathonsRepository, ParticipantsRepository, type Participant } from '@blikka/db'
import { RealtimeEventsService } from '@blikka/realtime'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { BadRequestError, ConflictError, NotFoundError, PreconditionFailedError } from '../errors'
import {
  EncryptedPhoneNumber,
  PhoneNumberEncryptionService,
} from '../utils/phone-number-encryption'
import { makeMarathon } from '../test/fixtures/marathon'
import { makeTopic } from '../test/fixtures/topic'
import { ParticipantsService, ParticipantsServiceLayerNoDeps } from './service'

const domain = 'demo'
const reference = '1001'

interface TestState {
  readonly marathon: ReturnType<typeof makeMarathon> | undefined
  readonly participant: Participant | undefined
  readonly participantByPhone: Participant | undefined
  readonly updateCalls: ReadonlyArray<{ id: number; data: Record<string, unknown> }>
}

const makeParticipant = (overrides: Partial<Participant> = {}): Participant =>
  ({
    id: 1,
    domain,
    reference,
    marathonId: 1,
    status: 'registered',
    email: 'participant@example.com',
    firstname: 'Jane',
    lastname: 'Doe',
    participantMode: 'marathon',
    phoneHash: null,
    phoneEncrypted: null,
    submissions: [],
    competitionClass: { name: 'Open', description: 'Open class' },
    deviceGroup: { name: 'Mobile', description: 'Phone', icon: 'smartphone' },
    ...overrides,
  }) as Participant

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: makeMarathon(),
  participant: makeParticipant(),
  participantByPhone: undefined,
  updateCalls: [],
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

  const participantsRepository = ParticipantsRepository.of({
    getParticipantByReference: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.participant)
      }),
    getInfiniteParticipantsByDomain: () =>
      Effect.succeed({ participants: [], nextCursor: undefined }),
    deleteParticipant: ({ id }: { id: number }) => Effect.succeed(makeParticipant({ id })),
    createParticipant: ({ data }: { data: Record<string, unknown> }) =>
      Effect.succeed({ id: 2, ...data } as Participant),
    batchDeleteParticipants: () => Effect.succeed({ deletedCount: 0, failedIds: [] }),
    batchVerifyParticipants: () => Effect.succeed({ updatedCount: 0, failedIds: [] }),
    batchMarkParticipantsCompleted: () => Effect.succeed({ updatedCount: 0, failedIds: [] }),
    getParticipantById: () => Effect.succeed(Option.none()),
    getByPhoneHashForByCamera: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.participantByPhone)
      }),
    updateParticipantById: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        updateCalls: [...state.updateCalls, { id, data }],
      })).pipe(Effect.as(undefined)),
  } as unknown as ParticipantsRepository['Service'])

  const phoneEncryption = PhoneNumberEncryptionService.of({
    decrypt: () => Effect.succeed('+4712345678'),
    encrypt: () =>
      Effect.succeed({
        hash: 'phone-hash',
        encrypted: EncryptedPhoneNumber('encrypted-phone'),
      }),
    hashLookup: () => Effect.succeed('phone-hash'),
  } as unknown as PhoneNumberEncryptionService['Service'])

  const realtimeEvents = RealtimeEventsService.of({
    emitEventResult: () => Effect.void,
  } as unknown as RealtimeEventsService['Service'])

  const emailService = EmailService.of({
    send: () => Effect.void,
  } as unknown as EmailService['Service'])

  return ParticipantsServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(PhoneNumberEncryptionService)(phoneEncryption),
        Layer.succeed(RealtimeEventsService)(realtimeEvents),
        Layer.succeed(EmailService)(emailService),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, ParticipantsService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(configLayerFromEnv({ NODE_ENV: 'test' })),
  )

describe('ParticipantsService', () => {
  it.effect('hides topic names that are not public or active', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          participant: makeParticipant({
            submissions: [
              {
                key: 'demo/1001/01/original.jpg',
                thumbnailKey: 'demo/1001/01/thumb.jpg',
                status: 'uploaded',
                createdAt: '2026-01-01T00:00:00.000Z',
                topic: makeTopic({ name: 'Secret Topic', visibility: 'hidden', orderIndex: 0 }),
              },
            ] as never,
          }),
        }),
      )

      const { result } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ParticipantsService
          return yield* service.getPublicParticipantByReference({
            domain,
            reference,
          })
        }),
      )

      assert.equal(result.publicSubmissions[0]?.topic.name, '')
      assert.equal(result.publicSubmissions[0]?.topic.orderIndex, 0)
    }),
  )

  it.effect('rejects by-camera contact updates for classic marathon mode', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ParticipantsService
          return yield* Effect.flip(
            service.updateByCameraParticipantContact({
              domain,
              reference,
              firstname: 'Jane',
              lastname: 'Doe',
              email: 'jane@example.com',
              phone: '+4712345678',
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, PreconditionFailedError)
    }),
  )

  it.effect('rejects marathon contact updates when required fields are blank', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ParticipantsService
          return yield* Effect.flip(
            service.updateMarathonParticipantContact({
              domain,
              reference,
              firstname: ' ',
              lastname: 'Doe',
              email: 'jane@example.com',
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, BadRequestError)
    }),
  )

  it.effect('rejects duplicate phone numbers for by-camera participants', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          marathon: makeMarathon({ mode: 'by-camera' }),
          participant: makeParticipant({
            id: 1,
            participantMode: 'by-camera',
          }),
          participantByPhone: makeParticipant({ id: 2, reference: '1002' }),
        }),
      )

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ParticipantsService
          return yield* Effect.flip(
            service.updateByCameraParticipantContact({
              domain,
              reference,
              firstname: 'Jane',
              lastname: 'Doe',
              email: 'jane@example.com',
              phone: '+4712345678',
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, ConflictError)
    }),
  )

  it.effect('fails getByReference when participant does not exist', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ participant: undefined }))

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ParticipantsService
          return yield* Effect.flip(
            service.getByReference({
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
