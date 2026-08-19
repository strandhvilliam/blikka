
import { Config, Effect, Layer, Option, Schema, Context } from 'effect'
import { SignJWT, jwtVerify } from 'jose'
import {
  EmailService,
  EmailServiceLayer,
  JuryInviteEmail,
  juryInviteEmailSubject,
} from '@blikka/email'
import {
  DbLayer,
  DbError,
  JuryRepository,
  MarathonsRepository,
  ParticipantsRepository,
  type CompetitionClass,
  type DeviceGroup,
  type JuryInvitation,
  type JuryRating,
  type Marathon,
  type NewJuryInvitation,
  type Participant,
  type Submission,
  type Topic,
} from '@blikka/db'
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalApiError,
  NotFoundError,
  PreconditionFailedError,
  UnauthorizedError,
  failNotFoundIfNone,
  type ApiErrorCode,
} from '../errors'

type JuryApiError =
  | BadRequestError
  | ConflictError
  | ForbiddenError
  | InternalApiError
  | NotFoundError
  | PreconditionFailedError
  | UnauthorizedError
import type {
  CreateJuryInvitationInput,
  CreateJuryRating,
  DeleteJuryInvitationInput,
  DeleteJuryRating,
  GetJuryInvitationByIdInput,
  GetJuryInvitationsByDomainInput,
  GetJuryParticipantCount,
  GetJuryRatingsByInvitation,
  GetJuryReviewResultsByInvitationIdInput,
  GetJuryResultsByDomainInput,
  GetJuryShortlist,
  GetJurySubmissionsFromToken,
  SetJuryShortlistPick,
  SetJuryShortlistWinner,
  UpdateJuryInvitationInput,
  UpdateJuryInvitationStatusByToken,
  UpdateJuryRating,
  VerifyJuryToken,
  GetJuryInvitationStatisticsByIdInput,
  ResendJuryInvitationEmailInput,
  ExtendJuryInvitationExpiryInput,
  RegenerateJuryInvitationTokenInput,
} from './contracts'
import {
  JURY_SHORTLIST_SIZE,
  getJuryShortlistWinnerId,
  getRequiredJuryShortlistSize,
  isJuryShortlistComplete,
} from './shortlist'
import {
  buildJuryInviteUrl,
  computeJuryJwtExpSeconds,
  constantTimeTokenEquals,
  formatJuryExpiryLabel,
  formatJuryScopeLabel,
  normalizeEmail,
} from './helpers'
import { getErrorMessage } from '../voting/helpers'

const MAX_EXPIRY_DAYS = 90

const JuryTokenPayloadSchema = Schema.Struct({
  domain: Schema.String,
  invitationId: Schema.Number,
  iat: Schema.Number,
  exp: Schema.Number,
})

type JuryTokenPayload = Schema.Schema.Type<typeof JuryTokenPayloadSchema>

interface JuryInvitationWithOptions extends JuryInvitation {
  topic: Topic | null
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
}

interface JuryInvitationWithMarathon extends JuryInvitationWithOptions {
  marathon: Marathon
}

/** The participant columns both admin result lists join on. */
type JuryParticipantLabel = Pick<Participant, 'id' | 'reference' | 'firstname' | 'lastname'>

interface JuryReviewResultsParticipantSummary extends JuryParticipantLabel {
  /** The image the juror judged: the topic submission, or the contact sheet on a class invite. */
  submissionKey: string | null
  submissionThumbnailKey: string | null
  contactSheetKey: string | null
}

interface JuryReviewResultsRatingRow {
  participantId: number
  rating: number
  notes: string | null
  participant: JuryReviewResultsParticipantSummary
}

interface JuryReviewResultsShortlistRow {
  participantId: number
  isWinner: boolean
  participant: JuryReviewResultsParticipantSummary
}

/**
 * One juror's verdict, carrying enough scope to group jurors who reviewed the same topic or class.
 * Grouping and consensus live in the client, which already owns how a scope is labelled.
 */
interface JuryDomainResultRow {
  invitationId: number
  displayName: string
  email: string
  status: string | null
  inviteType: string
  topic: { id: number; name: string; orderIndex: number } | null
  competitionClass: { id: number; name: string } | null
  deviceGroup: { id: number; name: string } | null
  winner: JuryReviewResultsParticipantSummary | null
  shortlist: JuryReviewResultsShortlistRow[]
}

/**
 * The juror's shortlist as the review UI needs it: which submissions are on it, which one wins, and
 * how far off completion the review is. `reference` keeps the jury side anonymous — no names.
 */
interface JuryShortlistState {
  picks: { participantId: number; reference: string; isWinner: boolean }[]
  winnerParticipantId: number | null
  /** Hard cap on shortlist size; adding beyond it is rejected. */
  maxSize: number
  /** Picks needed to complete — the cap, or the whole review set when that is smaller. */
  requiredSize: number
  isComplete: boolean
}

interface JurySubmissionListParticipant extends Pick<
  Participant,
  'id' | 'createdAt' | 'reference' | 'status'
> {
  submission: Submission & { topic: Topic | null }
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  contactSheetKey?: string | null
}

interface JurySubmissionsFromTokenPage {
  participants: JurySubmissionListParticipant[]
  nextCursor: number | null
}

function mapTokenError(message: string, code: ApiErrorCode): JuryApiError {
  switch (code) {
    case 'BAD_REQUEST':
      return new BadRequestError({ message })
    case 'UNAUTHORIZED':
      return new UnauthorizedError({ message })
    case 'FORBIDDEN':
      return new ForbiddenError({ message })
    case 'NOT_FOUND':
      return new NotFoundError({
        resource: message.replace(/ not found$/i, ''),
      })
    case 'CONFLICT':
      return new ConflictError({ message })
    case 'PRECONDITION_FAILED':
      return new PreconditionFailedError({ message })
    case 'INTERNAL_SERVER_ERROR':
      return new InternalApiError({ message })
  }
}

/**
 * Jury invitations, token verification, ratings, and shortlists for marathon organizers and invite links.
 */
export class JuryService extends Context.Service<
  JuryService,
  {
    /** Lists jury invitations for a marathon `domain` with topic/class/device relations. */
    readonly getJuryInvitationsByDomain: (
      input: GetJuryInvitationsByDomainInput,
    ) => Effect.Effect<JuryInvitationWithOptions[], DbError, never>

    /** Loads one invitation by id or fails with {@link JuryApiError}. */
    readonly getJuryInvitationById: (
      input: GetJuryInvitationByIdInput,
    ) => Effect.Effect<JuryInvitationWithOptions, DbError | JuryApiError, never>

    /**
     * The juror's outcome for an invitation as the admin needs to read it: who won, what else made
     * the shortlist, how full that shortlist is meant to be, and the private ratings behind it.
     */
    readonly getJuryReviewResultsByInvitationId: (
      input: GetJuryReviewResultsByInvitationIdInput,
    ) => Effect.Effect<
      {
        ratings: JuryReviewResultsRatingRow[]
        shortlist: JuryReviewResultsShortlistRow[]
        /** Picks needed to complete the review — the cap, or the review set when that is smaller. */
        requiredShortlistSize: number
        maxShortlistSize: number
      },
      DbError | JuryApiError,
      never
    >

    /**
     * Every juror's verdict for a marathon in one read, so the admin can compare jurors who reviewed
     * the same scope instead of clicking through invitations one at a time.
     */
    readonly getJuryResultsByDomain: (
      input: GetJuryResultsByDomainInput,
    ) => Effect.Effect<JuryDomainResultRow[], DbError | JuryApiError, never>

    /** Creates an invitation, issues a JWT, persists `token`, sends invite email, returns hydrated row. */
    readonly createJuryInvitation: (
      input: CreateJuryInvitationInput,
    ) => Effect.Effect<
      { invitation: JuryInvitationWithOptions; emailWarning?: string },
      DbError | Config.ConfigError | JuryApiError,
      never
    >

    /** Statistics for admin monitoring (progress, distribution, recent ratings). */
    readonly getJuryInvitationStatisticsById: (
      input: GetJuryInvitationStatisticsByIdInput,
    ) => Effect.Effect<
      {
        totalParticipants: number
        ratedParticipants: number
        progressPercentage: number
        averageRating: number
        ratingDistribution: { rating: number; count: number }[]
      },
      DbError | JuryApiError,
      never
    >

    /** Resends the jury invite email for an invitation. */
    readonly resendJuryInvitationEmail: (
      input: ResendJuryInvitationEmailInput,
    ) => Effect.Effect<{ sent: boolean; warning?: string }, DbError | JuryApiError, never>

    /** Updates invitation expiry (admin). */
    readonly extendJuryInvitationExpiry: (
      input: ExtendJuryInvitationExpiryInput,
    ) => Effect.Effect<JuryInvitationWithOptions, DbError | JuryApiError, never>

    /** Issues a new token for an invitation; invalidates the previous link. */
    readonly regenerateJuryInvitationToken: (
      input: RegenerateJuryInvitationTokenInput,
    ) => Effect.Effect<JuryInvitationWithOptions, DbError | Config.ConfigError | JuryApiError, never>

    /** Patches fields on an invitation; fails if the row does not exist. */
    readonly updateJuryInvitation: (
      input: UpdateJuryInvitationInput,
    ) => Effect.Effect<JuryInvitation, DbError | JuryApiError, never>

    /** Deletes an invitation by id; fails if missing. */
    readonly deleteJuryInvitation: (
      input: DeleteJuryInvitationInput,
    ) => Effect.Effect<JuryInvitation, DbError | JuryApiError, never>

    /** Verifies a jury JWT for `domain` and returns the decoded payload. */
    readonly verifyTokenPayload: (
      input: VerifyJuryToken,
    ) => Effect.Effect<JuryTokenPayload, Config.ConfigError | JuryApiError, never>

    /**
     * Full gate for invite links: validates token, loads invitation + marathon, enforces expiry and marathon mode.
     */
    readonly verifyTokenAndGetInitialData: (
      input: VerifyJuryToken,
    ) => Effect.Effect<JuryInvitationWithMarathon, Config.ConfigError | JuryApiError, never>

    /** Cursor page of submissions for the invite; class invites may attach latest contact sheet key per row. */
    readonly getJurySubmissionsFromToken: (
      input: GetJurySubmissionsFromToken,
    ) => Effect.Effect<
      JurySubmissionsFromTokenPage,
      DbError | Config.ConfigError | JuryApiError,
      never
    >

    /** All ratings for the invitation behind a token (no nested participant objects). */
    readonly getJuryRatingsByInvitation: (input: GetJuryRatingsByInvitation) => Effect.Effect<
      {
        ratings: {
          participantId: number
          rating: number
          notes: string | null
        }[]
      },
      DbError | Config.ConfigError | JuryApiError,
      never
    >

    /** Shortlist state for the invitation behind a token. */
    readonly getJuryShortlist: (
      input: GetJuryShortlist,
    ) => Effect.Effect<JuryShortlistState, DbError | Config.ConfigError | JuryApiError, never>

    /** Adds or removes a shortlist pick; fails once the shortlist is at its cap. */
    readonly setShortlistPick: (
      input: SetJuryShortlistPick,
    ) => Effect.Effect<JuryShortlistState, DbError | Config.ConfigError | JuryApiError, never>

    /** Picks the winner out of the shortlist, or clears it with a `null` participant. */
    readonly setShortlistWinner: (
      input: SetJuryShortlistWinner,
    ) => Effect.Effect<JuryShortlistState, DbError | Config.ConfigError | JuryApiError, never>

    /** Participant count for the invite scope with optional rating filter. */
    readonly getJuryParticipantCount: (
      input: GetJuryParticipantCount,
    ) => Effect.Effect<{ value: number }, DbError | Config.ConfigError | JuryApiError, never>

    /** Upserts the private star rating and notes for a participant. */
    readonly createRating: (
      input: CreateJuryRating,
    ) => Effect.Effect<JuryRating, DbError | Config.ConfigError | JuryApiError, never>

    /** Updates the rating; deletes the row once both the stars and the notes are empty. */
    readonly updateRating: (
      input: UpdateJuryRating,
    ) => Effect.Effect<JuryRating | null, DbError | Config.ConfigError | JuryApiError, never>

    /** Deletes rating row for participant on this invite; returns removed id or null. */
    readonly deleteRating: (
      input: DeleteJuryRating,
    ) => Effect.Effect<number | null, DbError | Config.ConfigError | JuryApiError, never>

    /** Advances invitation status; completing requires a full shortlist with a winner picked. */
    readonly updateInvitationStatusByToken: (
      input: UpdateJuryInvitationStatusByToken,
    ) => Effect.Effect<
      JuryInvitationWithMarathon,
      DbError | Config.ConfigError | JuryApiError,
      never
    >
  }
>()('@blikka/api/JuryService') {}

const makeJuryService = Effect.gen(function* () {
  const juryRepository = yield* JuryRepository
  const marathonsRepository = yield* MarathonsRepository
  const participantsRepository = yield* ParticipantsRepository
  const emailService = yield* EmailService

  const _generateJuryToken = Effect.fn('JuryService._generateJuryToken')(function* ({
    domain,
    invitationId,
    expiresAt,
  }: {
    domain: string
    invitationId: number
    expiresAt: string
  }) {
    const secretEnv = yield* Config.string('JURY_JWT_SECRET')
    const secret = new TextEncoder().encode(secretEnv)
    const iat = Math.floor(Date.now() / 1000)
    const exp = computeJuryJwtExpSeconds(expiresAt, iat, MAX_EXPIRY_DAYS)

    const payload = {
      domain,
      invitationId,
      iat,
      exp,
    }

    return yield* Effect.tryPromise({
      try: () =>
        new SignJWT(payload)
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt(iat)
          .setExpirationTime(exp)
          .sign(secret),
      catch: (error) =>
        new InternalApiError({
          message: `Failed to generate jury token: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        }),
    })
  })

  const verifyTokenPayload: JuryService['Service']['verifyTokenPayload'] = Effect.fn(
    'JuryService.verifyTokenPayload',
  )(function* ({ token, domain }) {
    const secretEnv = yield* Config.string('JURY_JWT_SECRET')

    const verified = yield* Effect.tryPromise({
      try: () => jwtVerify(token, new TextEncoder().encode(secretEnv)),
      catch: () => mapTokenError('Invalid token', 'NOT_FOUND'),
    })

    const payload = yield* Schema.decodeUnknownEffect(JuryTokenPayloadSchema)(
      verified.payload,
    ).pipe(Effect.mapError(() => mapTokenError('Invalid token', 'NOT_FOUND')))

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return yield* Effect.fail(mapTokenError('Invitation expired', 'UNAUTHORIZED'))
    }

    if (payload.domain !== domain) {
      return yield* Effect.fail(mapTokenError('Invitation not found', 'NOT_FOUND'))
    }

    return payload satisfies JuryTokenPayload
  })

  const getInvitationFromToken = Effect.fn('JuryService.getInvitationFromToken')(function* ({
    token,
    domain,
  }) {
    const payload = yield* verifyTokenPayload({ token, domain })

    const invitation = yield* juryRepository
      .getJuryDataByTokenPayload({
        domain,
        invitationId: payload.invitationId,
      })
      .pipe(
        Effect.mapError((error) => {
          const message = error instanceof Error ? error.message : String(error)
          if (message.includes('Invitation not found')) {
            return mapTokenError('Invitation not found', 'NOT_FOUND')
          }
          if (message.includes('Marathon not found')) {
            return mapTokenError('Marathon not found', 'NOT_FOUND')
          }
          return mapTokenError('Failed to load invitation', 'INTERNAL_SERVER_ERROR')
        }),
      )

    if (!constantTimeTokenEquals(token, invitation.token)) {
      return yield* Effect.fail(mapTokenError('Invitation link revoked', 'NOT_FOUND'))
    }

    const invitationExpiry = new Date(invitation.expiresAt)
    if (invitationExpiry < new Date()) {
      return yield* Effect.fail(mapTokenError('Invitation expired', 'UNAUTHORIZED'))
    }

    if (invitation.marathon?.mode !== 'marathon') {
      return yield* Effect.fail(mapTokenError('Unsupported marathon mode', 'BAD_REQUEST'))
    }

    return invitation
  })

  const ensureInvitationEditable = Effect.fn('JuryService.ensureInvitationEditable')(function* ({
    invitation,
  }) {
    if (invitation.status === 'completed') {
      return yield* Effect.fail(mapTokenError('Review already completed', 'BAD_REQUEST'))
    }

    yield* Effect.void
  })

  const getJuryInvitationsByDomain: JuryService['Service']['getJuryInvitationsByDomain'] =
    Effect.fn('JuryService.getJuryInvitationsByDomain')(function* ({ domain }) {
      return yield* juryRepository.getJuryInvitationsByDomain({ domain })
    })

  const getJuryInvitationById: JuryService['Service']['getJuryInvitationById'] = Effect.fn(
    'JuryService.getJuryInvitationById',
  )(function* ({ id }) {
    return yield* juryRepository
      .getJuryInvitationById({ id })
      .pipe(failNotFoundIfNone('JuryInvitation', { id }))
  })

  const getJuryReviewResultsByInvitationId: JuryService['Service']['getJuryReviewResultsByInvitationId'] =
    Effect.fn('JuryService.getJuryReviewResultsByInvitationId')(function* ({ id }) {
      yield* juryRepository
        .getJuryInvitationById({ id })
        .pipe(failNotFoundIfNone('JuryInvitation', { id }))

      const [ratings, shortlist, participantCount] = yield* Effect.all(
        [
          juryRepository.getJuryRatingsByInvitation({ invitationId: id }),
          juryRepository.getJuryShortlistByInvitation({ invitationId: id }),
          juryRepository.getJuryParticipantCount({ invitationId: id }),
        ],
        { concurrency: 3 },
      )

      // One preview lookup covers both lists — every shortlisted participant is usually rated too.
      const participantIds = Array.from(
        new Set([
          ...ratings.map((rating) => rating.participantId),
          ...shortlist.map((pick) => pick.participantId),
        ]),
      )
      const previews = yield* juryRepository.getJuryParticipantPreviews({
        invitationId: id,
        participantIds,
      })
      const previewByParticipantId = new Map(
        previews.map((preview) => [preview.participantId, preview] as const),
      )

      const toParticipantSummary = (
        participant: JuryParticipantLabel,
      ): JuryReviewResultsParticipantSummary => {
        const preview = previewByParticipantId.get(participant.id)
        return {
          id: participant.id,
          reference: participant.reference,
          firstname: participant.firstname,
          lastname: participant.lastname,
          submissionKey: preview?.submissionKey ?? null,
          submissionThumbnailKey: preview?.submissionThumbnailKey ?? null,
          contactSheetKey: preview?.contactSheetKey ?? null,
        }
      }

      return {
        ratings: ratings.map((rating) => ({
          participantId: rating.participantId,
          rating: rating.rating,
          notes: rating.notes,
          participant: toParticipantSummary(rating.participant),
        })),
        shortlist: shortlist.map((pick) => ({
          participantId: pick.participantId,
          isWinner: pick.isWinner,
          participant: toParticipantSummary(pick.participant),
        })),
        requiredShortlistSize: getRequiredJuryShortlistSize(participantCount.value),
        maxShortlistSize: JURY_SHORTLIST_SIZE,
      }
    })

  const getJuryResultsByDomain: JuryService['Service']['getJuryResultsByDomain'] = Effect.fn(
    'JuryService.getJuryResultsByDomain',
  )(function* ({ domain }) {
    const invitations = yield* juryRepository.getJuryInvitationsByDomain({ domain })
    // Every invitation from a domain lookup shares the marathon, so the first row settles the scope.
    const marathonId = invitations[0]?.marathonId
    if (marathonId === undefined) {
      return []
    }

    const picks = yield* juryRepository.getJuryShortlistsByMarathonId({ marathonId })

    const picksByInvitationId = new Map<number, typeof picks>()
    for (const pick of picks) {
      const existing = picksByInvitationId.get(pick.invitationId)
      if (existing) {
        existing.push(pick)
      } else {
        picksByInvitationId.set(pick.invitationId, [pick])
      }
    }

    const previews = yield* juryRepository.getJuryParticipantPreviewsByMarathon({
      marathonId,
      topicIds: Array.from(
        new Set(
          invitations.flatMap((invitation) => (invitation.topicId ? [invitation.topicId] : [])),
        ),
      ),
      participantIds: Array.from(new Set(picks.map((pick) => pick.participantId))),
    })

    const submissionByTopicAndParticipant = new Map(
      previews.byTopic.map((row) => [`${row.topicId}:${row.participantId}`, row] as const),
    )
    const contactSheetByParticipant = new Map(
      previews.contactSheets.map((row) => [row.participantId, row.contactSheetKey] as const),
    )

    return invitations.map((invitation) => {
      const toParticipantSummary = (
        participant: JuryParticipantLabel,
      ): JuryReviewResultsParticipantSummary => {
        if (invitation.inviteType === 'class') {
          return {
            id: participant.id,
            reference: participant.reference,
            firstname: participant.firstname,
            lastname: participant.lastname,
            submissionKey: null,
            submissionThumbnailKey: null,
            contactSheetKey: contactSheetByParticipant.get(participant.id) ?? null,
          }
        }

        const submission =
          invitation.topicId === null || invitation.topicId === undefined
            ? undefined
            : submissionByTopicAndParticipant.get(`${invitation.topicId}:${participant.id}`)

        return {
          id: participant.id,
          reference: participant.reference,
          firstname: participant.firstname,
          lastname: participant.lastname,
          submissionKey: submission?.submissionKey ?? null,
          submissionThumbnailKey: submission?.submissionThumbnailKey ?? null,
          contactSheetKey: null,
        }
      }

      const shortlist = (picksByInvitationId.get(invitation.id) ?? []).map((pick) => ({
        participantId: pick.participantId,
        isWinner: pick.isWinner,
        participant: toParticipantSummary(pick.participant),
      }))

      return {
        invitationId: invitation.id,
        displayName: invitation.displayName,
        email: invitation.email,
        status: invitation.status,
        inviteType: invitation.inviteType,
        topic: invitation.topic
          ? {
              id: invitation.topic.id,
              name: invitation.topic.name,
              orderIndex: invitation.topic.orderIndex,
            }
          : null,
        competitionClass: invitation.competitionClass
          ? { id: invitation.competitionClass.id, name: invitation.competitionClass.name }
          : null,
        deviceGroup: invitation.deviceGroup
          ? { id: invitation.deviceGroup.id, name: invitation.deviceGroup.name }
          : null,
        winner: shortlist.find((pick) => pick.isWinner)?.participant ?? null,
        shortlist,
      } satisfies JuryDomainResultRow
    })
  })

  const ensureParticipantInInvitationScope = Effect.fn(
    'JuryService.ensureParticipantInInvitationScope',
  )(function* ({ invitationId, participantId }) {
    const matchesScope = yield* juryRepository.participantMatchesInvitationScope({
      invitationId,
      participantId,
    })

    if (!matchesScope) {
      return yield* Effect.fail(
        mapTokenError('Participant not found in this jury review', 'BAD_REQUEST'),
      )
    }

    yield* Effect.void
  })

  /**
   * The single read every shortlist mutation returns, so the client never has to reconcile a
   * partial response against its cache.
   */
  const loadShortlistState = Effect.fn('JuryService.loadShortlistState')(function* ({
    invitationId,
  }: {
    invitationId: number
  }) {
    const [shortlist, participantCount] = yield* Effect.all(
      [
        juryRepository.getJuryShortlistByInvitation({ invitationId }),
        juryRepository.getJuryParticipantCount({ invitationId }),
      ],
      { concurrency: 2 },
    )

    const picks = shortlist.map((pick) => ({
      participantId: pick.participantId,
      reference: pick.participant.reference,
      isWinner: pick.isWinner,
    }))
    const requiredSize = getRequiredJuryShortlistSize(participantCount.value)

    return {
      picks,
      winnerParticipantId: getJuryShortlistWinnerId(picks),
      maxSize: JURY_SHORTLIST_SIZE,
      requiredSize,
      isComplete: isJuryShortlistComplete({ picks, requiredSize }),
    } satisfies JuryShortlistState
  })

  const validateExpiryAt = (expiresAt: string) =>
    Effect.gen(function* () {
      const expiry = new Date(expiresAt)
      if (Number.isNaN(expiry.getTime())) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'Invalid expiry date',
          }),
        )
      }

      const now = new Date()
      if (expiry <= now) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'Expiry must be in the future',
          }),
        )
      }

      const maxExpiry = new Date(now)
      maxExpiry.setDate(maxExpiry.getDate() + MAX_EXPIRY_DAYS)
      if (expiry > maxExpiry) {
        return yield* Effect.fail(
          new BadRequestError({
            message: `Expiry cannot be more than ${MAX_EXPIRY_DAYS} days from now`,
          }),
        )
      }

      return expiry
    })

  const sendJuryInviteEmailForInvitation = Effect.fn(
    'JuryService.sendJuryInviteEmailForInvitation',
  )(function* ({
    invitation,
    marathon,
    domain,
    idempotencyKey,
  }: {
    invitation: JuryInvitationWithOptions
    marathon: Marathon
    domain: string
    idempotencyKey: string
  }) {
    const email = normalizeEmail(invitation.email)
    if (!email) {
      return {
        sent: false,
        warning: 'No valid email address on this invitation' as string | undefined,
      }
    }

    const juryUrl = buildJuryInviteUrl({ domain, token: invitation.token })
    const scopeLabel = formatJuryScopeLabel({
      inviteType: invitation.inviteType as 'topic' | 'class',
      topicName: invitation.topic?.name ?? null,
      competitionClassName: invitation.competitionClass?.name ?? null,
      deviceGroupName: invitation.deviceGroup?.name ?? null,
    })
    const expiresAtLabel = formatJuryExpiryLabel(invitation.expiresAt)
    const emailProps = {
      juryMemberName: invitation.displayName,
      marathonName: marathon.name,
      juryUrl,
      marathonLogoUrl: marathon.logoUrl,
      scopeLabel,
      expiresAtLabel,
      organizerNotes: invitation.notes,
    }

    const sendResult = yield* emailService
      .send({
        to: email,
        subject: juryInviteEmailSubject(emailProps),
        template: JuryInviteEmail(emailProps),
        tags: [
          { name: 'category', value: 'jury-invite' },
          { name: 'marathon', value: marathon.name },
        ],
        idempotencyKey,
      })
      .pipe(
        Effect.as({ sent: true as const, warning: undefined as string | undefined }),
        Effect.catch((error) =>
          Effect.logError('Failed to send jury invite email', error).pipe(
            Effect.as({
              sent: false as const,
              warning: getErrorMessage(error, 'Failed to send jury invite email'),
            }),
          ),
        ),
      )

    return sendResult
  })

  const createJuryInvitation: JuryService['Service']['createJuryInvitation'] = Effect.fn(
    'JuryService.createJuryInvitation',
  )(function* ({ domain, data }) {
    const hasTopicId = data.topicId !== null && data.topicId !== undefined
    const hasCompetitionClassId =
      data.competitionClassId !== null && data.competitionClassId !== undefined

    if (hasTopicId && hasCompetitionClassId) {
      return yield* Effect.fail(
        new BadRequestError({
          message:
            'Cannot create invitation with both topic and competition class. Choose either topic invite or class invite.',
        }),
      )
    }

    if (!hasTopicId && !hasCompetitionClassId) {
      return yield* Effect.fail(
        new BadRequestError({
          message:
            'Must specify either topicId for topic invite or competitionClassId for class invite.',
        }),
      )
    }

    if (hasTopicId) {
      if (data.competitionClassId !== null && data.competitionClassId !== undefined) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'Topic invites cannot have competition class specified.',
          }),
        )
      }
      if (data.deviceGroupId !== null && data.deviceGroupId !== undefined) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'Topic invites cannot have device group specified.',
          }),
        )
      }
    }

    if (hasCompetitionClassId) {
      if (data.topicId !== null && data.topicId !== undefined) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'Class invites cannot have topic specified.',
          }),
        )
      }
    }

    yield* validateExpiryAt(data.expiresAt)

    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))
    const marathonId = marathon.id

    const invitationData: NewJuryInvitation = {
      email: data.email,
      displayName: data.displayName,
      inviteType: data.inviteType,
      topicId: data.topicId ?? null,
      competitionClassId: data.competitionClassId ?? null,
      deviceGroupId: data.deviceGroupId ?? null,
      expiresAt: data.expiresAt,
      notes: data.notes ?? null,
      status: data.status ?? 'pending',
      marathonId,
      token: '',
    }

    const result = yield* juryRepository.createJuryInvitation({
      data: invitationData,
    })
    const token = yield* _generateJuryToken({
      domain,
      invitationId: result.id,
      expiresAt: data.expiresAt,
    })

    yield* juryRepository.updateJuryInvitation({
      id: result.id,
      data: { token },
    })

    const invitation = yield* juryRepository
      .getJuryInvitationById({ id: result.id })
      .pipe(failNotFoundIfNone('JuryInvitation', { id: result.id }))

    const { sent, warning } = yield* sendJuryInviteEmailForInvitation({
      invitation,
      marathon,
      domain,
      idempotencyKey: `jury-invite/${invitation.id}`,
    })

    return {
      invitation,
      ...(sent || !warning ? {} : { emailWarning: warning }),
    }
  })

  const getJuryInvitationStatisticsById: JuryService['Service']['getJuryInvitationStatisticsById'] =
    Effect.fn('JuryService.getJuryInvitationStatisticsById')(function* ({ id }) {
      yield* juryRepository
        .getJuryInvitationById({ id })
        .pipe(failNotFoundIfNone('JuryInvitation', { id }))

      return yield* juryRepository.getJuryInvitationStatistics({ invitationId: id })
    })

  const resendJuryInvitationEmail: JuryService['Service']['resendJuryInvitationEmail'] = Effect.fn(
    'JuryService.resendJuryInvitationEmail',
  )(function* ({ id, domain }) {
    const invitation = yield* juryRepository
      .getJuryInvitationById({ id })
      .pipe(failNotFoundIfNone('JuryInvitation', { id }))

    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    if (invitation.marathonId !== marathon.id) {
      return yield* Effect.fail(
        new BadRequestError({
          message: 'Invitation does not belong to this marathon',
        }),
      )
    }

    const invitationExpiry = new Date(invitation.expiresAt)
    if (invitationExpiry < new Date()) {
      return yield* Effect.fail(
        new BadRequestError({
          message: 'Cannot resend email for an expired invitation',
        }),
      )
    }

    const { sent, warning } = yield* sendJuryInviteEmailForInvitation({
      invitation,
      marathon,
      domain,
      // New key per intentional resend; stable for in-process retries of this attempt.
      idempotencyKey: `jury-invite/${invitation.id}/resend/${crypto.randomUUID()}`,
    })

    if (!sent) {
      return yield* Effect.fail(
        new BadRequestError({
          message: warning ?? 'Failed to send jury invite email',
        }),
      )
    }

    return { sent: true }
  })

  const extendJuryInvitationExpiry: JuryService['Service']['extendJuryInvitationExpiry'] =
    Effect.fn('JuryService.extendJuryInvitationExpiry')(function* ({ id, expiresAt }) {
      yield* validateExpiryAt(expiresAt)

      yield* juryRepository
        .getJuryInvitationById({ id })
        .pipe(failNotFoundIfNone('JuryInvitation', { id }))

      yield* juryRepository.updateJuryInvitation({
        id,
        data: {
          expiresAt,
          updatedAt: new Date().toISOString(),
        },
      })

      return yield* juryRepository
        .getJuryInvitationById({ id })
        .pipe(failNotFoundIfNone('JuryInvitation', { id }))
    })

  const regenerateJuryInvitationToken: JuryService['Service']['regenerateJuryInvitationToken'] =
    Effect.fn('JuryService.regenerateJuryInvitationToken')(function* ({ id, domain }) {
      const invitation = yield* juryRepository
        .getJuryInvitationById({ id })
        .pipe(failNotFoundIfNone('JuryInvitation', { id }))

      if (invitation.status === 'completed') {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'Cannot regenerate link for a completed review',
          }),
        )
      }

      const marathon = yield* marathonsRepository
        .getMarathonByDomain({ domain })
        .pipe(failNotFoundIfNone('Marathon', { domain }))

      if (invitation.marathonId !== marathon.id) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'Invitation does not belong to this marathon',
          }),
        )
      }

      const token = yield* _generateJuryToken({
        domain,
        invitationId: id,
        expiresAt: invitation.expiresAt,
      })

      yield* juryRepository.updateJuryInvitation({
        id,
        data: {
          token,
          updatedAt: new Date().toISOString(),
        },
      })

      return yield* juryRepository
        .getJuryInvitationById({ id })
        .pipe(failNotFoundIfNone('JuryInvitation', { id }))
    })

  const updateJuryInvitation: JuryService['Service']['updateJuryInvitation'] = Effect.fn(
    'JuryService.updateJuryInvitation',
  )(function* ({ id, data }) {
    yield* juryRepository
      .getJuryInvitationById({ id })
      .pipe(failNotFoundIfNone('JuryInvitation', { id }))

    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    } satisfies Partial<NewJuryInvitation>

    return yield* juryRepository.updateJuryInvitation({
      id,
      data: updateData,
    })
  })

  const deleteJuryInvitation: JuryService['Service']['deleteJuryInvitation'] = Effect.fn(
    'JuryService.deleteJuryInvitation',
  )(function* ({ id }) {
    yield* juryRepository
      .getJuryInvitationById({ id })
      .pipe(failNotFoundIfNone('JuryInvitation', { id }))

    return yield* juryRepository.deleteJuryInvitation({ id })
  })

  const verifyTokenAndGetInitialData: JuryService['Service']['verifyTokenAndGetInitialData'] =
    Effect.fn('JuryService.verifyTokenAndGetInitialData')(function* ({ token, domain }) {
      return yield* getInvitationFromToken({ token, domain })
    })

  const getJurySubmissionsFromToken: JuryService['Service']['getJurySubmissionsFromToken'] =
    Effect.fn('JuryService.getJurySubmissionsFromToken')(function* ({
      token,
      domain,
      cursor,
      ratingFilter,
    }) {
      const invitation = yield* getInvitationFromToken({ token, domain })

      const result = yield* juryRepository.getJurySubmissionsFromToken({
        invitationId: invitation.id,
        cursor,
        ratingFilter: ratingFilter ? [...ratingFilter] : undefined,
      })

      if (invitation.inviteType !== 'class') {
        return result
      }

      const participants = yield* Effect.forEach(
        result.participants,
        (participant) =>
          participantsRepository
            .getParticipantByReference({
              domain,
              reference: participant.reference,
            })
            .pipe(
              Effect.map((participantDetails) => {
                if (Option.isNone(participantDetails)) {
                  return {
                    ...participant,
                    contactSheetKey: null,
                  }
                }

                const latestContactSheet =
                  participantDetails.value.contactSheets
                    .slice()
                    .sort(
                      (left, right) =>
                        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
                    )[0] ?? null

                return {
                  ...participant,
                  contactSheetKey: latestContactSheet?.key ?? null,
                }
              }),
            ),
        { concurrency: 10 },
      )

      return {
        ...result,
        participants,
      }
    })

  const getJuryRatingsByInvitation: JuryService['Service']['getJuryRatingsByInvitation'] =
    Effect.fn('JuryService.getJuryRatingsByInvitation')(function* ({ token, domain }) {
      const invitation = yield* getInvitationFromToken({ token, domain })
      const ratings = yield* juryRepository.getJuryRatingsByInvitation({
        invitationId: invitation.id,
      })
      return {
        ratings: ratings.map((rating) => ({
          participantId: rating.participantId,
          rating: rating.rating,
          notes: rating.notes,
        })),
      }
    })

  const getJuryShortlist: JuryService['Service']['getJuryShortlist'] = Effect.fn(
    'JuryService.getJuryShortlist',
  )(function* ({ token, domain }) {
    const invitation = yield* getInvitationFromToken({ token, domain })
    return yield* loadShortlistState({ invitationId: invitation.id })
  })

  const setShortlistPick: JuryService['Service']['setShortlistPick'] = Effect.fn(
    'JuryService.setShortlistPick',
  )(function* ({ token, domain, participantId, selected }) {
    const invitation = yield* getInvitationFromToken({ token, domain })
    yield* ensureInvitationEditable({ invitation })
    yield* ensureParticipantInInvitationScope({
      invitationId: invitation.id,
      participantId,
    })

    const existing = yield* juryRepository.getJuryShortlistPick({
      invitationId: invitation.id,
      participantId,
    })

    if (selected && !existing) {
      const shortlist = yield* juryRepository.getJuryShortlistByInvitation({
        invitationId: invitation.id,
      })

      if (shortlist.length >= JURY_SHORTLIST_SIZE) {
        return yield* Effect.fail(
          mapTokenError(
            `Your shortlist already holds ${JURY_SHORTLIST_SIZE} submissions — remove one before adding another`,
            'BAD_REQUEST',
          ),
        )
      }

      yield* juryRepository.createJuryShortlistPick({
        invitationId: invitation.id,
        participantId,
      })
    }

    // Deleting the row drops the win with it, so the winner can never sit off the shortlist.
    if (!selected && existing) {
      yield* juryRepository.deleteJuryShortlistPick({
        invitationId: invitation.id,
        participantId,
      })
    }

    return yield* loadShortlistState({ invitationId: invitation.id })
  })

  const setShortlistWinner: JuryService['Service']['setShortlistWinner'] = Effect.fn(
    'JuryService.setShortlistWinner',
  )(function* ({ token, domain, participantId }) {
    const invitation = yield* getInvitationFromToken({ token, domain })
    yield* ensureInvitationEditable({ invitation })

    if (participantId === null) {
      yield* juryRepository.clearJuryShortlistWinner({ invitationId: invitation.id })
      return yield* loadShortlistState({ invitationId: invitation.id })
    }

    yield* ensureParticipantInInvitationScope({
      invitationId: invitation.id,
      participantId,
    })

    const existing = yield* juryRepository.getJuryShortlistPick({
      invitationId: invitation.id,
      participantId,
    })

    if (!existing) {
      return yield* Effect.fail(
        mapTokenError(
          'Add the submission to your shortlist before picking it as the winner',
          'BAD_REQUEST',
        ),
      )
    }

    if (!existing.isWinner) {
      // Must clear first: only one row per invitation may carry the win.
      yield* juryRepository.clearJuryShortlistWinner({
        invitationId: invitation.id,
        exceptParticipantId: participantId,
      })
      yield* juryRepository.markJuryShortlistWinner({
        invitationId: invitation.id,
        participantId,
      })
    }

    return yield* loadShortlistState({ invitationId: invitation.id })
  })

  const getJuryParticipantCount: JuryService['Service']['getJuryParticipantCount'] = Effect.fn(
    'JuryService.getJuryParticipantCount',
  )(function* ({ token, domain, ratingFilter }) {
    const invitation = yield* getInvitationFromToken({ token, domain })
    return yield* juryRepository.getJuryParticipantCount({
      invitationId: invitation.id,
      ratingFilter: ratingFilter ? [...ratingFilter] : undefined,
    })
  })

  /** Insert or update `jury_ratings` so we never hit unique violations. */
  const upsertJuryRating = Effect.fn('JuryService.upsertJuryRating')(function* ({
    invitationId,
    participantId,
    rating,
    notes,
  }) {
    const existing = yield* juryRepository.getJuryRating({
      invitationId,
      participantId,
    })
    return yield* Option.match(existing, {
      onSome: () =>
        juryRepository.updateJuryRating({
          invitationId,
          participantId,
          rating,
          notes,
        }),
      onNone: () =>
        juryRepository.createJuryRating({
          invitationId,
          participantId,
          rating,
          notes,
        }),
    })
  })

  const createRating: JuryService['Service']['createRating'] = Effect.fn(
    'JuryService.createRating',
  )(function* ({ token, domain, participantId, rating, notes }) {
    const invitation = yield* getInvitationFromToken({ token, domain })
    yield* ensureInvitationEditable({ invitation })
    yield* ensureParticipantInInvitationScope({
      invitationId: invitation.id,
      participantId,
    })

    return yield* upsertJuryRating({
      invitationId: invitation.id,
      participantId,
      rating,
      notes,
    })
  })

  const updateRating: JuryService['Service']['updateRating'] = Effect.fn(
    'JuryService.updateRating',
  )(function* ({ token, domain, participantId, rating, notes }) {
    const invitation = yield* getInvitationFromToken({ token, domain })
    yield* ensureInvitationEditable({ invitation })
    yield* ensureParticipantInInvitationScope({
      invitationId: invitation.id,
      participantId,
    })

    // Ratings are private review aids and live independently of the shortlist: clearing the stars
    // and notes drops the row without touching whether the submission is shortlisted.
    if (rating === 0 && !notes?.trim()) {
      const deleted = yield* juryRepository.deleteJuryRating({
        invitationId: invitation.id,
        participantId,
      })

      return yield* Option.match(deleted, {
        onSome: (result) => Effect.succeed(result[0] ?? null),
        onNone: () => Effect.succeed(null),
      })
    }

    return yield* upsertJuryRating({
      invitationId: invitation.id,
      participantId,
      rating,
      notes,
    })
  })

  const deleteRating: JuryService['Service']['deleteRating'] = Effect.fn(
    'JuryService.deleteRating',
  )(function* ({ token, domain, participantId }) {
    const invitation = yield* getInvitationFromToken({ token, domain })
    yield* ensureInvitationEditable({ invitation })
    const deleted = yield* juryRepository.deleteJuryRating({
      invitationId: invitation.id,
      participantId,
    })

    return yield* Option.match(deleted, {
      onSome: (result) => Effect.succeed(result[0]?.id ?? null),
      onNone: () => Effect.succeed(null),
    })
  })

  const updateInvitationStatusByToken: JuryService['Service']['updateInvitationStatusByToken'] =
    Effect.fn('JuryService.updateInvitationStatusByToken')(function* ({ token, domain, status }) {
      const invitation = yield* getInvitationFromToken({ token, domain })
      if (invitation.status === 'completed' && status !== 'completed') {
        return yield* Effect.fail(mapTokenError('Review already completed', 'BAD_REQUEST'))
      }

      if (status === 'completed') {
        const shortlist = yield* loadShortlistState({ invitationId: invitation.id })

        if (!shortlist.isComplete) {
          return yield* Effect.fail(
            mapTokenError(
              `You must shortlist ${shortlist.requiredSize} submissions and pick a winner before completing the review`,
              'BAD_REQUEST',
            ),
          )
        }
      }

      yield* juryRepository.updateJuryInvitation({
        id: invitation.id,
        data: {
          status,
          updatedAt: new Date().toISOString(),
        },
      })

      return yield* getInvitationFromToken({ token, domain })
    })

  return JuryService.of({
    getJuryInvitationsByDomain,
    getJuryInvitationById,
    getJuryReviewResultsByInvitationId,
    getJuryResultsByDomain,
    getJuryInvitationStatisticsById,
    createJuryInvitation,
    resendJuryInvitationEmail,
    extendJuryInvitationExpiry,
    regenerateJuryInvitationToken,
    updateJuryInvitation,
    deleteJuryInvitation,
    verifyTokenPayload,
    verifyTokenAndGetInitialData,
    getJurySubmissionsFromToken,
    getJuryRatingsByInvitation,
    getJuryShortlist,
    setShortlistPick,
    setShortlistWinner,
    getJuryParticipantCount,
    createRating,
    updateRating,
    deleteRating,
    updateInvitationStatusByToken,
  })
})

export const JuryServiceLayerNoDeps = Layer.effect(JuryService, makeJuryService)

export const JuryServiceLayer = JuryServiceLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DbLayer, EmailServiceLayer)),
)
