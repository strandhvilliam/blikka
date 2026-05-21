import { assert, describe, it } from '@effect/vitest'
import {
  MarathonsRepository,
  ParticipantsRepository,
  SubmissionsRepository,
  type Marathon,
  type Participant,
  type Topic,
} from '@blikka/db'
import {
  UploadSessionRepository,
  type ParticipantState,
  type SubmissionState,
} from '@blikka/kv-store'
import { Effect, Layer, Option, Ref } from 'effect'

import { BadRequestError } from '../errors'
import { ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE } from '../shared/upload'
import { PhoneNumberEncryptionService } from '../utils/phone-number-encryption'
import {
  ByCameraUploadInitializerService,
  ByCameraUploadInitializerServiceLayerNoDeps,
} from './initialize-by-camera-upload'
import { UploadProvisionerService } from './provision-upload'

const domain = 'demo'
const reference = '1234'
const phoneNumber = '+4712345678'
const activeTopicOrderIndex = 2
const uploadSessionId = 'upload-session-1'

interface TestMarathon extends Marathon {
  topics: Topic[]
  competitionClasses: { id: number; numberOfPhotos: number }[]
  deviceGroups: { id: number }[]
}

interface TestParticipant extends Participant {
  participantMode: 'by-camera' | 'standard'
}

interface TestState {
  readonly marathon: TestMarathon | undefined
  readonly participantByReference: TestParticipant | undefined
  readonly participantByPhone: TestParticipant | undefined
  readonly participantByGeneratedReference: Map<string, TestParticipant | undefined>
  readonly activeTopicSubmission: { id: number; status: string } | null
  readonly participantState: ParticipantState | undefined
  readonly submissionStates: Record<number, SubmissionState | undefined>
  readonly participantCreates: ReadonlyArray<Record<string, unknown>>
  readonly participantUpdates: ReadonlyArray<Record<string, unknown>>
  readonly submissionDeletes: ReadonlyArray<number>
  readonly referenceLookups: ReadonlyArray<string>
  readonly phoneUniquenessChecks: ReadonlyArray<{ phoneHash: string; excludeParticipantId?: number }>
  readonly provisionCalls: ReadonlyArray<Record<string, unknown>>
  readonly nextParticipantId: number
  readonly forceReferenceCollision: boolean
  readonly referenceCollisionCount: number
}

const makeTopic = (overrides: Partial<Topic> = {}): Topic =>
  ({
    id: 10,
    orderIndex: activeTopicOrderIndex,
    visibility: 'active',
    scheduledStart: '2020-01-01T00:00:00.000Z',
    scheduledEnd: '2099-01-01T00:00:00.000Z',
    ...overrides,
  }) as Topic

const makeMarathon = (overrides: Partial<TestMarathon> = {}): TestMarathon =>
  ({
    id: 1,
    domain,
    mode: 'by-camera',
    setupCompleted: true,
    topics: [makeTopic()],
    competitionClasses: [{ id: 5, numberOfPhotos: 1 }],
    deviceGroups: [{ id: 7 }],
    ...overrides,
  }) as TestMarathon

const makeParticipant = (overrides: Partial<TestParticipant> = {}): TestParticipant =>
  ({
    id: 42,
    reference,
    domain,
    status: 'initialized',
    marathonId: 1,
    participantMode: 'by-camera',
    ...overrides,
  }) as TestParticipant

const makeParticipantState = (overrides: Partial<ParticipantState> = {}): ParticipantState => ({
  uploadSessionId,
  expectedCount: 1,
  orderIndexes: [activeTopicOrderIndex],
  processedIndexes: [],
  validated: false,
  zipKey: '',
  contactSheetKey: '',
  errors: [],
  finalized: false,
  checkedAt: null,
  ...overrides,
})

const makeSubmissionState = (overrides: Partial<SubmissionState> = {}): SubmissionState => ({
  uploadSessionId,
  key: `${domain}/${reference}/02/photo.jpg`,
  orderIndex: activeTopicOrderIndex,
  uploaded: false,
  thumbnailKey: null,
  exifProcessed: false,
  ...overrides,
})

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: makeMarathon(),
  participantByReference: undefined,
  participantByPhone: undefined,
  participantByGeneratedReference: new Map(),
  activeTopicSubmission: null,
  participantState: undefined,
  submissionStates: {},
  participantCreates: [],
  participantUpdates: [],
  submissionDeletes: [],
  referenceLookups: [],
  phoneUniquenessChecks: [],
  provisionCalls: [],
  nextParticipantId: 100,
  forceReferenceCollision: false,
  referenceCollisionCount: 1,
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const deviceInput = {
  variant: 'device' as const,
  domain,
  firstname: 'Ada',
  lastname: 'Lovelace',
  email: 'ada@example.com',
  deviceGroupId: 7,
  phoneNumber,
}

const staffInput = {
  variant: 'staff' as const,
  domain,
  reference,
  firstname: 'Ada',
  lastname: 'Lovelace',
  email: 'ada@example.com',
  deviceGroupId: 7,
  phoneNumber,
}

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomainWithOptions: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.marathon)
      }),
  } as unknown as MarathonsRepository['Service'])

  const participantsRepository = ParticipantsRepository.of({
      getParticipantByReference: ({
        reference: lookupReference,
        domain: lookupDomain,
      }: {
        reference: string
        domain: string
      }) =>
        Effect.gen(function* () {
          yield* updateTestState(stateRef, (current) => ({
            ...current,
            referenceLookups: [...current.referenceLookups, lookupReference],
          }))

          const state = yield* Ref.get(stateRef)

          const generated = state.participantByGeneratedReference.get(lookupReference)
          if (generated !== undefined) {
            return Option.fromNullishOr(generated)
          }

          if (
            state.participantByReference &&
            state.participantByReference.reference === lookupReference &&
            state.participantByReference.domain === lookupDomain
          ) {
            return Option.some(state.participantByReference)
          }

          if (state.forceReferenceCollision && lookupReference.length === 4) {
            const collisionIndex = state.referenceLookups.filter((value) => value.length === 4).length
            if (collisionIndex <= state.referenceCollisionCount) {
              return Option.some(makeParticipant({ reference: lookupReference, id: 999 }))
            }
          }

          return Option.none()
        }),
      getByPhoneHashForByCamera: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return Option.fromNullishOr(state.participantByPhone)
        }),
      createParticipant: ({ data }: { data: Record<string, unknown> }) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const participant = makeParticipant({
            id: state.nextParticipantId,
            reference: String((data as { reference?: string }).reference ?? reference),
            ...(data as Partial<TestParticipant>),
          })

          yield* updateTestState(stateRef, (current) => ({
            ...current,
            participantCreates: [...current.participantCreates, data],
            nextParticipantId: current.nextParticipantId + 1,
          }))

          return participant
        }),
      updateParticipantById: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          participantUpdates: [...state.participantUpdates, { id, ...data }],
        })).pipe(
          Effect.map(() =>
            makeParticipant({
              id,
              ...(data as Partial<TestParticipant>),
            }),
          ),
        ),
      recordParticipantTermsAcceptance: () => Effect.void,
  } as unknown as ParticipantsRepository['Service'])

  const submissionsRepository = SubmissionsRepository.of({
      getSubmissionByParticipantIdAndTopicId: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return Option.fromNullishOr(state.activeTopicSubmission)
        }),
      deleteSubmissionById: ({ id }: { id: number }) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          submissionDeletes: [...state.submissionDeletes, id],
        })).pipe(Effect.as(undefined)),
  } as unknown as SubmissionsRepository['Service'])

  const uploadKv = UploadSessionRepository.of({
      getParticipantState: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return Option.fromNullishOr(state.participantState)
        }),
      getSubmissionState: (
        _lookupDomain: string,
        _lookupReference: string,
        orderIndex: number,
      ) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return Option.fromNullishOr(state.submissionStates[orderIndex])
        }),
  } as unknown as UploadSessionRepository['Service'])

  const phoneEncryption = PhoneNumberEncryptionService.of({
    hashLookup: () => Effect.succeed('phone-hash'),
    encrypt: () =>
      Effect.succeed({
        encrypted: 'phone-encrypted',
        hash: 'phone-hash',
      }),
    decrypt: () => Effect.succeed(phoneNumber),
  } as unknown as PhoneNumberEncryptionService['Service'])

  const uploadProvisioner = UploadProvisionerService.of({
      resetAndSeedUploadExif: () => Effect.void,
      provisionSingleByCameraUpload: (input: Record<string, unknown>) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          provisionCalls: [...state.provisionCalls, input],
        })).pipe(
          Effect.as({
            participantId: input.participantId as number,
            reference: input.reference as string,
            uploadSessionId,
            uploads: [
              {
                key: `${domain}/${input.reference as string}/02/photo.jpg`,
                url: 'https://example.com/presigned',
                contentType: input.resolvedContentType as string,
              },
            ],
          }),
        ),
  } as unknown as UploadProvisionerService['Service'])

  return ByCameraUploadInitializerServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(SubmissionsRepository)(submissionsRepository),
        Layer.succeed(UploadSessionRepository)(uploadKv),
        Layer.succeed(PhoneNumberEncryptionService)(phoneEncryption),
        Layer.succeed(UploadProvisionerService)(uploadProvisioner),
      ),
    ),
  )
}

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, ByCameraUploadInitializerService>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(makeTestLayer(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

describe('ByCameraUploadInitializerService', () => {
  it.effect('device upload creates a new participant and provisions upload', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const service = yield* ByCameraUploadInitializerService
          return yield* service.initializeByCameraUpload(deviceInput)
        }),
      )

      assert.lengthOf(state.participantCreates, 1)
      assert.lengthOf(state.provisionCalls, 1)
      assert.strictEqual(result.uploads[0]?.contentType, 'image/jpeg')
    }),
  )

  it.effect('device upload rejects already-uploaded topic without replace flag', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          participantByPhone: makeParticipant(),
          submissionStates: {
            [activeTopicOrderIndex]: makeSubmissionState({ uploaded: true }),
          },
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* ByCameraUploadInitializerService
            return yield* Effect.flip(service.initializeByCameraUpload(deviceInput))
          }),
      )

      assert.instanceOf(error, BadRequestError)
      assert.strictEqual(error.message, ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE)
      assert.deepStrictEqual(state.provisionCalls, [])
    }),
  )

  it.effect('device upload replaces active topic submission when allowed', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          participantByPhone: makeParticipant(),
          activeTopicSubmission: { id: 77, status: 'initialized' },
          submissionStates: {
            [activeTopicOrderIndex]: makeSubmissionState({ uploaded: true }),
          },
          participantState: makeParticipantState(),
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* ByCameraUploadInitializerService
            return yield* service.initializeByCameraUpload({
              ...deviceInput,
              replaceExistingActiveTopicUpload: true,
            })
          }),
      )

      assert.deepStrictEqual(state.submissionDeletes, [77])
      assert.lengthOf(state.provisionCalls, 1)
    }),
  )

  it.effect('staff upload rejects finalized participant without replaceCompletedParticipantUpload', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          participantByReference: makeParticipant({ status: 'completed' }),
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* ByCameraUploadInitializerService
            return yield* Effect.flip(service.initializeByCameraUpload(staffInput))
          }),
      )

      assert.instanceOf(error, BadRequestError)
      assert.match(error.message, /already completed upload flow/)
      assert.deepStrictEqual(state.provisionCalls, [])
    }),
  )

  it.effect('staff upload rejects phone already used by another participant', () =>
    Effect.gen(function* () {
      const { result: error } = yield* runWithState(
        makeInitialState({
          participantByReference: undefined,
          participantByPhone: makeParticipant({ id: 88, reference: '9999' }),
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* ByCameraUploadInitializerService
            return yield* Effect.flip(service.initializeByCameraUpload(staffInput))
          }),
      )

      assert.instanceOf(error, BadRequestError)
      assert.match(error.message, /Another participant already uses this phone number/)
    }),
  )

  it.effect('device upload retries reference generation on collision', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          forceReferenceCollision: true,
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* ByCameraUploadInitializerService
            return yield* service.initializeByCameraUpload(deviceInput)
          }),
      )

      assert.isAtLeast(state.referenceLookups.length, 2)
      assert.lengthOf(state.participantCreates, 1)
    }),
  )
})
