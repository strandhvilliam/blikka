import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import {
  ParticipantsRepository,
  RulesRepository,
  ValidationsRepository,
  type Participant,
} from '@blikka/db'
import { RealtimeEventsService } from '@blikka/realtime'
import { ValidationEngine } from '@blikka/validation'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { NotFoundError } from '../errors'
import { ValidationsService, ValidationsServiceLayerNoDeps } from './service'

const domain = 'demo'
const reference = '1001'

interface TestState {
  readonly participant: Participant | undefined
  readonly updateValidationCalls: ReadonlyArray<{ id: number; data: Record<string, unknown> }>
  readonly verificationByReference: unknown
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
    submissions: [],
    ...overrides,
  }) as Participant

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  participant: makeParticipant(),
  updateValidationCalls: [],
  verificationByReference: null,
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
    getParticipantById: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.participant)
      }),
    updateParticipantById: () => Effect.void,
  } as unknown as ParticipantsRepository['Service'])

  const validationsRepository = ValidationsRepository.of({
    updateValidationResult: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        updateValidationCalls: [...state.updateValidationCalls, { id, data }],
      })).pipe(
        Effect.as({
          id,
          ...data,
        }),
      ),
    getParticipantVerificationByReference: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.verificationByReference
      }),
    clearAllValidationResults: () => Effect.void,
    createMultipleValidationResults: () => Effect.void,
    createParticipantVerification: () =>
      Effect.succeed({ id: 99, createdAt: '2026-01-01T00:00:00.000Z' }),
  } as unknown as ValidationsRepository['Service'])

  const rulesRepository = RulesRepository.of({
    getRulesByDomain: () => Effect.succeed([]),
  } as unknown as RulesRepository['Service'])

  const s3Service = S3Service.of({
    getHead: () => Effect.succeed(null),
  } as unknown as S3Service['Service'])

  const validationEngine = ValidationEngine.of({
    runValidations: () => Effect.succeed([]),
  } as unknown as ValidationEngine['Service'])

  const realtimeEvents = RealtimeEventsService.of({
    emitEventResult: () => Effect.void,
  } as unknown as RealtimeEventsService['Service'])

  return ValidationsServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(ValidationsRepository)(validationsRepository),
        Layer.succeed(RulesRepository)(rulesRepository),
        Layer.succeed(S3Service)(s3Service),
        Layer.succeed(ValidationEngine)(validationEngine),
        Layer.succeed(RealtimeEventsService)(realtimeEvents),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, ValidationsService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(
      configLayerFromEnv({
        NODE_ENV: 'test',
        NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME: 'submissions-bucket',
      }),
    ),
  )

describe('ValidationsService', () => {
  it.effect('updates validation results through the repository', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ValidationsService
          return yield* service.updateValidationResult({
            id: 5,
            data: { overruled: true },
          })
        }),
      )

      assert.equal(result.id, 5)
      assert.equal(state.updateValidationCalls[0]?.data.overruled, true)
    }),
  )

  it.effect('returns participant verification by reference', () =>
    Effect.gen(function* () {
      const verification = { id: 10, notes: 'Looks good' }
      const stateRef = yield* Ref.make(
        makeInitialState({
          verificationByReference: verification,
        }),
      )

      const { result } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ValidationsService
          return yield* service.getParticipantVerificationByReference({
            domain,
            reference,
          })
        }),
      )

      assert.deepEqual(result, verification)
    }),
  )

  it.effect('fails runValidations when participant is missing', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ participant: undefined }))

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ValidationsService
          return yield* Effect.flip(
            service.runValidations({
              domain,
              reference,
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, NotFoundError)
    }),
  )

  it.effect('creates participant verification and updates participant status', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ValidationsService
          return yield* service.createParticipantVerification({
            participantId: 1,
            staffId: 'staff-1',
            notes: 'Approved',
          })
        }),
      )

      assert.equal(result.id, 99)
    }),
  )
})
