import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import {
  MarathonsRepository,
  ParticipantsRepository,
  SubmissionsRepository,
  type Marathon,
  type Participant,
  type Topic,
} from '@blikka/db'
import { UploadSessionRepository, type ParticipantState } from '@blikka/kv-store'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { BadRequestError } from '../errors'
import { PhoneNumberEncryptionService } from '../utils/phone-number-encryption'
import {
  MarathonUploadInitializerService,
  MarathonUploadInitializerServiceLayerNoDeps,
} from './initialize-marathon-upload'
import { UploadProvisionerService } from './provision-upload'

const domain = 'demo'
const reference = '1234'

interface TestMarathon extends Marathon {
  topics: Topic[]
  competitionClasses: {
    id: number
    topicStartIndex: number
    numberOfPhotos: number
  }[]
  deviceGroups: { id: number }[]
}

interface TestParticipant extends Participant {
  submissions: { id: number; status: string }[]
}

interface TestState {
  readonly marathon: TestMarathon | undefined
  readonly participant: TestParticipant | undefined
  readonly participantState: ParticipantState | undefined
  readonly participantCreates: ReadonlyArray<Record<string, unknown>>
  readonly participantUpdates: ReadonlyArray<Record<string, unknown>>
  readonly submissionCreates: ReadonlyArray<Record<string, unknown>>
  readonly submissionDeletes: ReadonlyArray<number[]>
  readonly kvInitializeCalls: ReadonlyArray<{
    domain: string
    reference: string
    keys: readonly string[]
  }>
  readonly presignedUrlCalls: ReadonlyArray<{ bucket: string; key: string; contentType: string }>
  readonly exifResets: ReadonlyArray<Record<string, unknown>>
  readonly generatedKeys: readonly string[]
  readonly presignedUrl: string
}

const makeTopic = (orderIndex: number): Topic =>
  ({
    id: orderIndex + 1,
    orderIndex,
    visibility: 'public',
    name: `Topic ${orderIndex}`,
  }) as Topic

const makeMarathon = (overrides: Partial<TestMarathon> = {}): TestMarathon =>
  ({
    id: 1,
    domain,
    mode: 'marathon',
    setupCompleted: true,
    startDate: '2026-05-21T10:00:00.000Z',
    endDate: '2026-05-21T18:00:00.000Z',
    topics: [makeTopic(0), makeTopic(1), makeTopic(2)],
    competitionClasses: [{ id: 5, topicStartIndex: 0, numberOfPhotos: 2 }],
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
    submissions: [],
    ...overrides,
  }) as TestParticipant

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: makeMarathon(),
  participant: undefined,
  participantState: undefined,
  participantCreates: [],
  participantUpdates: [],
  submissionCreates: [],
  submissionDeletes: [],
  kvInitializeCalls: [],
  presignedUrlCalls: [],
  exifResets: [],
  generatedKeys: [`${domain}/${reference}/00/photo.jpg`, `${domain}/${reference}/01/photo.jpg`],
  presignedUrl: 'https://example.com/presigned',
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const baseInitializeInput = {
  domain,
  reference,
  firstname: 'Ada',
  lastname: 'Lovelace',
  email: 'ada@example.com',
  competitionClassId: 5,
  deviceGroupId: 7,
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
      getParticipantByReference: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return Option.fromNullishOr(state.participant)
        }),
      createParticipant: ({ data }: { data: Record<string, unknown> }) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          participantCreates: [...state.participantCreates, data],
        })).pipe(
          Effect.as(
            makeParticipant({
              id: 99,
              ...(data as Partial<TestParticipant>),
            }),
          ),
        ),
      updateParticipantById: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          participantUpdates: [...state.participantUpdates, { id, ...data }],
        })).pipe(
          Effect.as(
            makeParticipant({
              id,
              ...(data as Partial<TestParticipant>),
            }),
          ),
        ),
      recordParticipantTermsAcceptance: () => Effect.void,
  } as unknown as ParticipantsRepository['Service'])

  const submissionsRepository = SubmissionsRepository.of({
      deleteMultipleSubmissions: ({ ids }: { ids: number[] }) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          submissionDeletes: [...state.submissionDeletes, ids],
        })).pipe(Effect.as(undefined)),
      createMultipleSubmissions: ({ data }: { data: Record<string, unknown>[] }) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          submissionCreates: [...state.submissionCreates, ...data],
        })).pipe(Effect.as(undefined)),
  } as unknown as SubmissionsRepository['Service'])

  const uploadKv = UploadSessionRepository.of({
      getParticipantState: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return Option.fromNullishOr(state.participantState)
        }),
      initializeState: (
        initDomain: string,
        initReference: string,
        _uploadSessionId: string,
        keys: readonly string[],
      ) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          kvInitializeCalls: [
            ...state.kvInitializeCalls,
            { domain: initDomain, reference: initReference, keys },
          ],
        })).pipe(Effect.as(undefined)),
  } as unknown as UploadSessionRepository['Service'])

  const s3 = S3Service.of({
      generateSubmissionKey: (_initDomain: string, _initReference: string, orderIndex: number) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return state.generatedKeys[orderIndex] ?? `${domain}/${reference}/${orderIndex}/photo.jpg`
        }),
      getPresignedUrl: (
        bucket: string,
        key: string,
        _method: 'PUT' | 'GET',
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
                contentType: options?.contentType ?? 'image/jpeg',
              },
            ],
          }))
          return state.presignedUrl
        }),
  } as unknown as S3Service['Service'])

  const phoneEncryption = PhoneNumberEncryptionService.of({
    hashLookup: () => Effect.succeed(null),
    encrypt: () =>
      Effect.succeed({
        encrypted: null,
        hash: null,
      }),
    decrypt: () => Effect.succeed(''),
  } as unknown as PhoneNumberEncryptionService['Service'])

  const uploadProvisioner = UploadProvisionerService.of({
      resetAndSeedUploadExif: (input: Record<string, unknown>) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          exifResets: [...state.exifResets, input],
        })).pipe(Effect.as(undefined)),
      provisionSingleByCameraUpload: () =>
        Effect.fail(new Error('not used in marathon initializer tests')),
  } as unknown as UploadProvisionerService['Service'])

  return MarathonUploadInitializerServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(SubmissionsRepository)(submissionsRepository),
        Layer.succeed(UploadSessionRepository)(uploadKv),
        Layer.succeed(S3Service)(s3),
        Layer.succeed(PhoneNumberEncryptionService)(phoneEncryption),
        Layer.succeed(UploadProvisionerService)(uploadProvisioner),
        configLayerFromEnv({ SUBMISSIONS_BUCKET_NAME: 'submissions-bucket' }),
      ),
    ),
  )
}

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, MarathonUploadInitializerService>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(makeTestLayer(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

describe('MarathonUploadInitializerService', () => {
  it.effect('initializeUploadFlow fails when uploads are closed', () =>
    Effect.gen(function* () {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const futureEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

      const { result: error } = yield* runWithState(
        makeInitialState({
          marathon: makeMarathon({
            startDate: futureStart,
            endDate: futureEnd,
          }),
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* MarathonUploadInitializerService
            return yield* Effect.flip(service.initializeUploadFlow(baseInitializeInput))
          }),
      )

      assert.instanceOf(error, BadRequestError)
    }),
  )

  it.effect('initializeUploadFlow blocks finalized participants', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          participant: makeParticipant({ status: 'completed', submissions: [{ id: 1, status: 'uploaded' }] }),
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* MarathonUploadInitializerService
            return yield* Effect.flip(service.initializeUploadFlow(baseInitializeInput))
          }),
      )

      assert.instanceOf(error, BadRequestError)
      assert.deepStrictEqual(state.submissionCreates, [])
    }),
  )

  it.effect('initializeUploadFlow creates participant, submissions, kv state, and presigned urls', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const service = yield* MarathonUploadInitializerService
          return yield* service.initializeUploadFlow(baseInitializeInput)
        }),
      )

      assert.strictEqual(result.reference, reference)
      assert.lengthOf(result.uploads, 2)
      assert.lengthOf(state.participantCreates, 1)
      assert.lengthOf(state.submissionCreates, 2)
      assert.lengthOf(state.kvInitializeCalls, 1)
      assert.lengthOf(state.presignedUrlCalls, 2)
      assert.lengthOf(state.exifResets, 1)
    }),
  )

  it.effect('initializeUploadFlow replaces existing submissions on re-init', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          participant: makeParticipant({
            submissions: [
              { id: 11, status: 'initialized' },
              { id: 12, status: 'initialized' },
            ],
          }),
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* MarathonUploadInitializerService
            return yield* service.initializeUploadFlow(baseInitializeInput)
          }),
      )

      assert.deepStrictEqual(state.submissionDeletes, [[11, 12]])
      assert.lengthOf(state.submissionCreates, 2)
    }),
  )

  it.effect('initializeUploadFlow rejects uploadContentTypes length mismatch', () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const service = yield* MarathonUploadInitializerService
          return yield* Effect.flip(
            service.initializeUploadFlow({
              ...baseInitializeInput,
              uploadContentTypes: ['image/jpeg'],
            }),
          )
        }),
      )

      assert.instanceOf(error, BadRequestError)
      assert.deepStrictEqual(state.presignedUrlCalls, [])
    }),
  )
})
