import { assert, describe, it } from '@effect/vitest'
import { S3Service, SQSService } from '@blikka/aws'
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
import { RealtimeEventsService } from '@blikka/realtime'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { BadRequestError } from '../errors'
import { PhoneNumberEncryptionService } from '../utils/phone-number-encryption'
import { UploadFlowService, UploadFlowServiceLayerNoDeps } from './service'

const domain = 'demo'
const reference = '1234'
const phoneNumber = '+4712345678'
const activeTopicOrderIndex = 2
const uploadSessionId = 'upload-session-1'

interface TestMarathon extends Marathon {
  topics: Topic[]
  competitionClasses: { id: number; topicStartIndex: number; numberOfPhotos: number }[]
  deviceGroups: { id: number }[]
}

interface TestParticipant extends Participant {
  submissions: { id: number; status: string }[]
}

interface TestState {
  readonly marathon: TestMarathon | undefined
  readonly participant: TestParticipant | undefined
  readonly participantByPhone: TestParticipant | undefined
  readonly activeTopicSubmission: { id: number; status: string } | null
  readonly participantState: ParticipantState | undefined
  readonly submissionStates: Record<number, SubmissionState | undefined>
  readonly participantCreates: ReadonlyArray<Record<string, unknown>>
  readonly participantUpdates: ReadonlyArray<Record<string, unknown>>
  readonly presignedUrlCalls: ReadonlyArray<{
    bucket: string
    key: string
    contentType: string
  }>
  readonly realtimeEvents: ReadonlyArray<{ eventKey: string; domain: string; reference?: string }>
  readonly presignedUrl: string
}

const makeTopic = (overrides: Partial<Topic> = {}): Topic =>
  ({
    id: 10,
    orderIndex: activeTopicOrderIndex,
    visibility: 'active',
    name: 'Active topic',
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
    topics: [makeTopic(), makeTopic({ id: 11, orderIndex: 3, visibility: 'hidden', name: 'Hidden' })],
    competitionClasses: [{ id: 5, topicStartIndex: 0, numberOfPhotos: 1 }],
    deviceGroups: [{ id: 7 }],
    ...overrides,
  }) as TestMarathon

const makeParticipant = (overrides: Partial<TestParticipant> = {}): TestParticipant =>
  ({
    id: 42,
    reference,
    domain,
    status: 'prepared',
    marathonId: 1,
    submissions: [],
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
  participant: undefined,
  participantByPhone: undefined,
  activeTopicSubmission: null,
  participantState: makeParticipantState(),
  submissionStates: {
    [activeTopicOrderIndex]: makeSubmissionState(),
  },
  participantCreates: [],
  participantUpdates: [],
  presignedUrlCalls: [],
  realtimeEvents: [],
  presignedUrl: 'https://example.com/presigned',
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

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
        const state = yield* Ref.get(stateRef)
        if (
          state.participant &&
          state.participant.reference === lookupReference &&
          state.participant.domain === lookupDomain
        ) {
          return Option.some(state.participant)
        }
        return Option.none()
      }),
    getByPhoneHashForByCamera: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.participantByPhone)
      }),
      createParticipant: ({ data }: { data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        participantCreates: [...state.participantCreates, data as Record<string, unknown>],
        participant: {
          ...(state.participant ?? makeParticipant()),
          ...(data as Partial<TestParticipant>),
          id: 99,
          status: String((data as { status?: string }).status ?? 'prepared'),
        } as TestParticipant,
      })).pipe(
        Effect.map(() => {
          const participant = makeParticipant({
            id: 99,
            status: 'prepared',
            ...(data as Partial<TestParticipant>),
          })
          return participant
        }),
      ),
      updateParticipantById: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        participantUpdates: [...state.participantUpdates, { id, ...data }],
        participant: {
          ...(state.participant ?? makeParticipant()),
          id,
          ...(data as Partial<TestParticipant>),
        } as TestParticipant,
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
      getAllSubmissionStates: (
        _lookupDomain: string,
        _lookupReference: string,
        orderIndexes: readonly number[],
      ) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return orderIndexes.flatMap((orderIndex: number) => {
            const submissionState = state.submissionStates[orderIndex]
            return submissionState ? [submissionState] : []
          })
        }),
  } as unknown as UploadSessionRepository['Service'])

  const s3 = S3Service.of({
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

  const sqs = SQSService.of({
    sendMessage: () => Effect.void,
  } as unknown as SQSService['Service'])

  const phoneEncryption = PhoneNumberEncryptionService.of({
    hashLookup: () => Effect.succeed('phone-hash'),
    encrypt: () =>
      Effect.succeed({
        encrypted: 'phone-encrypted',
        hash: 'phone-hash',
      }),
    decrypt: () => Effect.succeed(phoneNumber),
  } as unknown as PhoneNumberEncryptionService['Service'])

  const realtimeEvents = RealtimeEventsService.of({
      withEventResult: (
        effect: Effect.Effect<unknown, unknown, unknown>,
        event: {
          eventKey: string
          environment: string
          domain: string
          reference?: string
        },
      ) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        realtimeEvents: [
          ...state.realtimeEvents,
          {
            eventKey: event.eventKey,
            domain: event.domain,
            reference: event.reference,
          },
        ],
      })).pipe(Effect.flatMap(() => effect)),
      emitEventResult: () => Effect.void,
      emitVotingVoteCast: () => Effect.void,
  } as unknown as RealtimeEventsService['Service'])

  return UploadFlowServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(SubmissionsRepository)(submissionsRepository),
        Layer.succeed(UploadSessionRepository)(uploadKv),
        Layer.succeed(S3Service)(s3),
        Layer.succeed(SQSService)(sqs),
        Layer.succeed(PhoneNumberEncryptionService)(phoneEncryption),
        Layer.succeed(RealtimeEventsService)(realtimeEvents),
        configLayerFromEnv({
          SUBMISSIONS_BUCKET_NAME: 'submissions-bucket',
          UPLOAD_PROCESSOR_QUEUE_URL: 'https://sqs.example.com/queue',
          NODE_ENV: 'development',
        }),
      ),
    ),
  )
}

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, UploadFlowService>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(makeTestLayer(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

describe('UploadFlowService', () => {
  it.effect('getPublicMarathon redacts hidden topics and keeps active ones for by-camera mode', () =>
    Effect.gen(function* () {
      const { result } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const service = yield* UploadFlowService
          return yield* service.getPublicMarathon({ domain })
        }),
      )

      assert.lengthOf(result.topics, 1)
      assert.strictEqual(result.topics[0]?.visibility, 'active')
      assert.strictEqual(result.topics[0]?.name, 'Active topic')
    }),
  )

  it.effect('getPublicMarathon fails when marathon is missing', () =>
    Effect.gen(function* () {
      const { result: error } = yield* runWithState(
        makeInitialState({ marathon: undefined }),
        () =>
          Effect.gen(function* () {
            const service = yield* UploadFlowService
            return yield* Effect.flip(service.getPublicMarathon({ domain }))
          }),
      )

      assert.instanceOf(error, BadRequestError)
    }),
  )

  it.effect('resolveByCameraParticipantByPhone returns eligible when no participant matches', () =>
    Effect.gen(function* () {
      const { result } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const service = yield* UploadFlowService
          return yield* service.resolveByCameraParticipantByPhone({ domain, phoneNumber })
        }),
      )

      assert.strictEqual(result.match, false)
    }),
  )

  it.effect('resolveByCameraParticipantByPhone returns already-uploaded when KV submission is uploaded', () =>
    Effect.gen(function* () {
      const { result } = yield* runWithState(
        makeInitialState({
          participantByPhone: makeParticipant(),
          submissionStates: {
            [activeTopicOrderIndex]: makeSubmissionState({ uploaded: true }),
          },
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* UploadFlowService
            return yield* service.resolveByCameraParticipantByPhone({ domain, phoneNumber })
          }),
      )

      assert.strictEqual(result.match, true)
      assert.strictEqual(result.activeTopicUploadState, 'already-uploaded')
    }),
  )

  it.effect('prepareUploadFlow blocks finalized participants in marathon mode', () =>
    Effect.gen(function* () {
      const { result: error } = yield* runWithState(
        makeInitialState({
          marathon: makeMarathon({ mode: 'marathon' }),
          participant: makeParticipant({ status: 'completed' }),
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* UploadFlowService
            return yield* Effect.flip(
              service.prepareUploadFlow({
                domain,
                reference,
                firstname: 'Ada',
                lastname: 'Lovelace',
                email: 'ada@example.com',
                competitionClassId: 5,
                deviceGroupId: 7,
              }),
            )
          }),
      )

      assert.instanceOf(error, BadRequestError)
      assert.match(error.message, /already completed upload flow/)
    }),
  )

  it.effect('prepareUploadFlow creates a prepared participant and emits realtime event', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(
        makeInitialState({
          marathon: makeMarathon({ mode: 'marathon' }),
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* UploadFlowService
            return yield* service.prepareUploadFlow({
              domain,
              reference,
              firstname: 'Ada',
              lastname: 'Lovelace',
              email: 'ada@example.com',
              competitionClassId: 5,
              deviceGroupId: 7,
            })
          }),
      )

      assert.strictEqual(result.status, 'prepared')
      assert.lengthOf(state.participantCreates, 1)
      assert.deepStrictEqual(state.realtimeEvents, [
        {
          eventKey: 'participant-prepared',
          domain,
          reference,
        },
      ])
    }),
  )

  it.effect('refreshPresignedUploads fails when orderIndexes is empty', () =>
    Effect.gen(function* () {
      const { result: error } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const service = yield* UploadFlowService
          return yield* Effect.flip(
            service.refreshPresignedUploads({
              domain,
              reference,
              orderIndexes: [],
            }),
          )
        }),
      )

      assert.instanceOf(error, BadRequestError)
    }),
  )

  it.effect('refreshPresignedUploads returns presigned URLs for initialized submissions', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(
        makeInitialState({
          participant: makeParticipant({ status: 'initialized' }),
        }),
        () =>
          Effect.gen(function* () {
            const service = yield* UploadFlowService
            return yield* service.refreshPresignedUploads({
              domain,
              reference,
              orderIndexes: [activeTopicOrderIndex],
            })
          }),
      )

      assert.deepStrictEqual(result, [
        {
          key: `${domain}/${reference}/02/photo.jpg`,
          url: 'https://example.com/presigned',
          contentType: 'image/jpeg',
        },
      ])
      assert.lengthOf(state.presignedUrlCalls, 1)
    }),
  )
})
