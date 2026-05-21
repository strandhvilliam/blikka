import { assert, describe, it } from '@effect/vitest'
import { SMSService, SQSService } from '@blikka/aws'
import { EmailService } from '@blikka/email'
import {
  MarathonsRepository,
  ParticipantsRepository,
  SubmissionsRepository,
  VotingRepository,
} from '@blikka/db'
import { RealtimeEventsService } from '@blikka/realtime'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { PhoneNumberEncryptionService } from '../utils/phone-number-encryption'
import { makeMarathon } from '../test/fixtures/marathon'
import { makeTopic } from '../test/fixtures/topic'
import { BadRequestError } from '../errors'
import { VotingService, VotingServiceLayerNoDeps } from './service'

const domain = 'demo'
const topicId = 1
const marathonId = 1

interface TestState {
  readonly marathon: ReturnType<typeof makeMarathon>
  readonly votingWindow: { startsAt: string; endsAt: string | null } | null
  readonly sessionCount: number
  readonly sessionsByToken: Record<string, Record<string, unknown>>
}

const activeTopic = makeTopic({
  id: topicId,
  visibility: 'active',
  scheduledEnd: '2020-01-01T00:00:00.000Z',
})

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: makeMarathon({
    id: marathonId,
    domain,
    mode: 'by-camera',
    topics: [activeTopic],
  }),
  votingWindow: {
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.000Z',
  },
  sessionCount: 0,
  sessionsByToken: {},
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomainWithOptions: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.some(state.marathon)
      }),
  } as unknown as MarathonsRepository['Service'])

  const votingRepository = VotingRepository.of({
    getVotingSessionByToken: ({ token }: { token: string }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.sessionsByToken[token])
      }),
    getVotingWindowForTopic: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.votingWindow
      }),
    getLatestVotingRoundForTopic: () => Effect.succeed(Option.none()),
    countVotingSessionsForTopic: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.sessionCount
      }),
    getParticipantsWithSubmissionsButNoVotingSession: () => Effect.succeed([]),
    createVotingSessions: ({ sessions }: { sessions: ReadonlyArray<Record<string, unknown>> }) =>
      Effect.succeed(
        sessions.map((session, index) => ({
          id: index + 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: null,
          voteSubmissionId: null,
          votedAt: null,
          ...session,
        })),
      ),
  } as unknown as VotingRepository['Service'])

  const participantsRepository = ParticipantsRepository.of({} as ParticipantsRepository['Service'])
  const submissionsRepository = SubmissionsRepository.of({} as SubmissionsRepository['Service'])

  const smsService = SMSService.of({
    sendWithOptOutCheck: () => Effect.void,
  } as unknown as SMSService['Service'])

  const emailService = EmailService.of({
    send: () => Effect.void,
    sendBatch: () => Effect.void,
  } as unknown as EmailService['Service'])

  const sqsService = SQSService.of({
    sendMessage: () => Effect.void,
  } as unknown as SQSService['Service'])

  const realtimeEvents = RealtimeEventsService.of({
    emitVotingVoteCast: () => Effect.void,
  } as unknown as RealtimeEventsService['Service'])

  const phoneEncryption = PhoneNumberEncryptionService.of({
    decrypt: () => Effect.succeed('+4712345678'),
    encrypt: () => Effect.die('not used'),
    hashLookup: () => Effect.die('not used'),
  } as unknown as PhoneNumberEncryptionService['Service'])

  return VotingServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(VotingRepository)(votingRepository),
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(SubmissionsRepository)(submissionsRepository),
        Layer.succeed(SMSService)(smsService),
        Layer.succeed(EmailService)(emailService),
        Layer.succeed(SQSService)(sqsService),
        Layer.succeed(RealtimeEventsService)(realtimeEvents),
        Layer.succeed(PhoneNumberEncryptionService)(phoneEncryption),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, VotingService>,
) =>
  effect.pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(
      configLayerFromEnv({
        NODE_ENV: 'development',
        SUBMISSIONS_BUCKET_NAME: 'submissions-bucket',
        THUMBNAILS_BUCKET_NAME: 'thumbnails-bucket',
        VOTING_SMS_QUEUE_URL: 'https://example.com/queue',
      }),
    ),
  )

describe('VotingService', () => {
  it.effect('fails getVotingSession when token is unknown', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const error = yield* Effect.flip(
        runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* VotingService
            return yield* service.getVotingSession({ token: 'missing-token' })
          }),
        ),
      )

      assert.instanceOf(error, BadRequestError)
      assert.match(error.message, /Voting session not found/)
    }),
  )

  it.effect('returns participants without sessions as an empty list when voting has not started', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ sessionCount: 0 }))

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* VotingService
          return yield* service.getParticipantsWithoutVotingSession({
            domain,
            topicId,
          })
        }),
      )

      assert.deepEqual(result, [])
    }),
  )

  it.effect('rejects manual session creation when required contact fields are blank', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const error = yield* Effect.flip(
        runWithState(
          stateRef,
          Effect.gen(function* () {
            const service = yield* VotingService
            return yield* service.createManualVotingSession({
              domain,
              topicId,
              firstName: ' ',
              lastName: 'Voter',
              email: 'voter@example.com',
            })
          }),
        ),
      )

      assert.instanceOf(error, BadRequestError)
      assert.match(error.message, /required/)
    }),
  )

  it.effect('creates a manual voting session for the active by-camera topic', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const result = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* VotingService
          return yield* service.createManualVotingSession({
            domain,
            topicId,
            firstName: 'Manual',
            lastName: 'Voter',
            email: 'voter@example.com',
          })
        }),
      )

      assert.equal(result.session.email, 'voter@example.com')
      assert.match(result.votingUrl, new RegExp(`https://${domain}\\.blikka\\.app/live/vote/`))
    }),
  )
})
