import { assert, describe, it } from '@effect/vitest'
import {
  DbError,
  JuryRepository,
  MarathonsRepository,
  ParticipantsRepository,
  type JuryInvitation,
} from '@blikka/db'
import { EmailService } from '@blikka/email'
import { SignJWT } from 'jose'
import { Effect, Layer, Option, Ref } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { BadRequestError, NotFoundError } from '../errors'
import { makeMarathon } from '../test/fixtures/marathon'
import { JuryService, JuryServiceLayerNoDeps } from './service'

const domain = 'demo'
const marathonId = 1
const validExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

interface TestState {
  readonly marathon: ReturnType<typeof makeMarathon> | undefined
  readonly invitations: JuryInvitation[]
  readonly createCalls: ReadonlyArray<Record<string, unknown>>
  readonly emailSendShouldFail: boolean
  readonly sentEmails: ReadonlyArray<{ to: string; subject: string }>
}

const makeInvitation = (overrides: Partial<JuryInvitation> = {}): JuryInvitation =>
  ({
    id: 1,
    marathonId,
    email: 'juror@example.com',
    displayName: 'Juror One',
    inviteType: 'topic',
    topicId: 1,
    competitionClassId: null,
    deviceGroupId: null,
    expiresAt: validExpiresAt,
    notes: null,
    status: 'pending',
    token: 'signed-token',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as JuryInvitation

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  marathon: makeMarathon({ id: marathonId, domain }),
  invitations: [makeInvitation()],
  createCalls: [],
  emailSendShouldFail: false,
  sentEmails: [],
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

  const juryRepository = JuryRepository.of({
    getJuryInvitationsByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.invitations
      }),
    getJuryInvitationById: ({ id }: { id: number }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.invitations.find((invitation) => invitation.id === id))
      }),
    createJuryInvitation: ({ data }: { data: Record<string, unknown> }) =>
      updateTestState(stateRef, (state) => {
        const invitation = makeInvitation({
          id: 99,
          ...data,
        })
        return {
          ...state,
          createCalls: [...state.createCalls, data],
          invitations: [...state.invitations, invitation],
        }
      }).pipe(Effect.as(makeInvitation({ id: 99, ...data }))),
    updateJuryInvitation: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      Effect.gen(function* () {
        yield* updateTestState(stateRef, (state) => ({
          ...state,
          invitations: state.invitations.map((invitation) =>
            invitation.id === id ? makeInvitation({ ...invitation, ...data }) : invitation,
          ),
        }))

        const state = yield* Ref.get(stateRef)
        const updated = state.invitations.find((invitation) => invitation.id === id)
        if (!updated) {
          return yield* Effect.die(`missing invitation ${id}`)
        }

        return updated
      }),
    deleteJuryInvitation: ({ id }: { id: number }) =>
      Effect.succeed(makeInvitation({ id })),
    getJuryRatingsWithRankingsByInvitation: () => Effect.succeed([]),
    getJuryDataByTokenPayload: ({ invitationId }: { domain: string; invitationId: number }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const invitation = state.invitations.find((entry) => entry.id === invitationId)
        if (!invitation || !state.marathon) {
          return yield* Effect.fail(new DbError({ message: 'Invitation not found' }))
        }

        return {
          ...invitation,
          topic: null,
          competitionClass: null,
          deviceGroup: null,
          marathon: state.marathon,
        }
      }),
    getJurySubmissionsFromToken: () => Effect.die('not used in these tests'),
    getJuryRatingsByInvitation: () => Effect.die('not used in these tests'),
    getJuryParticipantCount: () => Effect.die('not used in these tests'),
    participantMatchesInvitationScope: () => Effect.die('not used in these tests'),
    getJuryFinalRankingByRank: () => Effect.die('not used in these tests'),
    deleteJuryFinalRankingByParticipant: () => Effect.die('not used in these tests'),
    getJuryFinalRankingByParticipant: () => Effect.die('not used in these tests'),
    updateJuryFinalRanking: () => Effect.die('not used in these tests'),
    createJuryFinalRanking: () => Effect.die('not used in these tests'),
    getJuryRating: () => Effect.die('not used in these tests'),
    updateJuryRating: () => Effect.die('not used in these tests'),
    createJuryRating: () => Effect.die('not used in these tests'),
    deleteJuryRating: () => Effect.die('not used in these tests'),
    getJuryAssignedFinalRankings: () => Effect.die('not used in these tests'),
  } as unknown as JuryRepository['Service'])

  const participantsRepository = ParticipantsRepository.of({} as ParticipantsRepository['Service'])

  const emailService = EmailService.of({
    send: (input: { to: string; subject: string }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (state.emailSendShouldFail) {
          return yield* Effect.fail(new Error('resend rejected email'))
        }
        yield* Ref.update(stateRef, (current) => ({
          ...current,
          sentEmails: [
            ...current.sentEmails,
            { to: input.to, subject: input.subject },
          ],
        }))
        return { id: 'email-1' }
      }),
    sendBatch: () => Effect.die('not used in jury tests'),
  } as unknown as EmailService['Service'])

  return JuryServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(JuryRepository)(juryRepository),
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(EmailService)(emailService),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, JuryService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(configLayerFromEnv({ JURY_JWT_SECRET: 'test-jury-secret-key-1234567890' })),
  )

describe('JuryService', () => {
  it.effect('rejects invitations that specify both topic and competition class', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* Effect.flip(
            service.createJuryInvitation({
              domain,
              data: {
                email: 'juror@example.com',
                displayName: 'Juror',
                inviteType: 'topic',
                topicId: 1,
                competitionClassId: 2,
                deviceGroupId: undefined,
                expiresAt: validExpiresAt,
              },
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, BadRequestError)
    }),
  )

  it.effect('creates a topic invitation and persists a generated token', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* service.createJuryInvitation({
            domain,
            data: {
              email: 'juror@example.com',
              displayName: 'Juror',
              inviteType: 'topic',
              topicId: 1,
              competitionClassId: undefined,
              deviceGroupId: undefined,
              expiresAt: validExpiresAt,
            },
          })
        }),
      )

      assert.equal(result.invitation.id, 99)
      assert.equal(state.createCalls[0]?.marathonId, marathonId)
      assert.equal(state.createCalls[0]?.topicId, 1)
      assert.equal(state.sentEmails.length, 1)
      assert.equal(state.sentEmails[0]?.to, 'juror@example.com')
    }),
  )

  it.effect('returns emailWarning when invite email fails but still creates invitation', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ emailSendShouldFail: true }))

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* service.createJuryInvitation({
            domain,
            data: {
              email: 'juror@example.com',
              displayName: 'Juror',
              inviteType: 'topic',
              topicId: 1,
              competitionClassId: undefined,
              deviceGroupId: undefined,
              expiresAt: validExpiresAt,
            },
          })
        }),
      )

      assert.equal(result.invitation.id, 99)
      assert.notEqual(result.emailWarning, undefined)
      assert.equal(state.sentEmails.length, 0)
    }),
  )

  it.effect('resendJuryInvitationEmail sends to the invitation address', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* service.resendJuryInvitationEmail({
            id: 1,
            domain,
          })
        }),
      )

      assert.equal(result.sent, true)
      assert.equal(state.sentEmails.length, 1)
      assert.equal(state.sentEmails[0]?.to, 'juror@example.com')
    }),
  )

  it.effect('fails getJuryInvitationById when invitation is missing', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState({ invitations: [] }))

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* Effect.flip(
            service.getJuryInvitationById({
              id: 404,
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, NotFoundError)
    }),
  )

  it.effect('rejects expired jury tokens', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())
      const secret = new TextEncoder().encode('test-jury-secret-key-1234567890')
      const expiredToken = yield* Effect.promise(() =>
        new SignJWT({ domain, invitationId: 1 })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
          .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
          .sign(secret),
      )

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* Effect.flip(
            service.verifyTokenPayload({
              token: expiredToken,
              domain,
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, NotFoundError)
    }),
  )

  it.effect('rejects verifyTokenPayload when domain does not match token payload', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result: createResult } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* service.createJuryInvitation({
            domain,
            data: {
              email: 'juror@example.com',
              displayName: 'Juror',
              inviteType: 'topic',
              topicId: 1,
              competitionClassId: undefined,
              deviceGroupId: undefined,
              expiresAt: validExpiresAt,
            },
          })
        }),
      )

      const error = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* Effect.flip(
            service.verifyTokenPayload({
              token: createResult.invitation.token,
              domain: 'other-domain',
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(error, NotFoundError)
    }),
  )

  it.effect('rejects stale tokens after regenerateJuryInvitationToken', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result: createResult } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* service.createJuryInvitation({
            domain,
            data: {
              email: 'juror@example.com',
              displayName: 'Juror',
              inviteType: 'topic',
              topicId: 1,
              competitionClassId: undefined,
              deviceGroupId: undefined,
              expiresAt: validExpiresAt,
            },
          })
        }),
      )

      const oldToken = createResult.invitation.token

      yield* Ref.update(stateRef, (state) => ({
        ...state,
        invitations: state.invitations.map((invitation) =>
          invitation.id === createResult.invitation.id
            ? makeInvitation({ ...invitation, token: 'rotated-stored-token' })
            : invitation,
        ),
      }))

      const revokedError = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* Effect.flip(
            service.verifyTokenAndGetInitialData({
              token: oldToken,
              domain,
            }),
          )
        }),
      ).pipe(Effect.map(({ result }) => result))

      assert.instanceOf(revokedError, NotFoundError)

      const { result: regenerated } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* service.regenerateJuryInvitationToken({
            id: createResult.invitation.id,
            domain,
          })
        }),
      )

      const { result: refreshed } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* JuryService
          return yield* service.verifyTokenAndGetInitialData({
            token: regenerated.token,
            domain,
          })
        }),
      )

      assert.equal(refreshed.id, 99)
    }),
  )
})
