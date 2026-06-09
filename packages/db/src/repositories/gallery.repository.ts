import { Context, Effect, Layer, Option } from 'effect'
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import { DrizzleClient } from '../drizzle-client'
import {
  competitionClasses,
  galleryPublications,
  juryFinalRankings,
  juryInvitations,
  participants,
  submissions,
  topics,
  votingRound,
  votingRoundSubmission,
  votingRoundVote,
} from '../schema'
import type { GalleryFeaturedSection, GalleryPublication } from '../types'
import { DbError } from '../utils'

/** A single public, PII-safe photo in the gallery feed. */
export interface GalleryFeedRow {
  submissionId: number
  submissionCreatedAt: string
  thumbnailKey: string | null
  key: string | null
  topicId: number
  topicName: string
  topicOrderIndex: number
  participantReference: string
  competitionClassId: number | null
  competitionClassName: string | null
}

/** Cursor page of {@link GalleryFeedRow}; `nextCursor` is the last submission id seen. */
export interface GalleryFeedPage {
  items: GalleryFeedRow[]
  nextCursor: string | null
}

/** A photo submitted by one finalized participant, used in participant-set views. */
export interface GalleryParticipantSubmission {
  submissionId: number
  submissionCreatedAt: string
  thumbnailKey: string | null
  key: string | null
  topicId: number
  topicName: string
  topicOrderIndex: number
}

/** A finalized participant and their uploaded submissions, identified only by reference. */
export interface GalleryParticipantSet {
  reference: string
  competitionClassId: number | null
  competitionClassName: string | null
  submissions: GalleryParticipantSubmission[]
}

/** A jury-ranked winning photo (topic winners) tied to a participant reference. */
export interface GalleryTopicWinnerRow {
  rank: number
  participantReference: string
  submissionId: number
  thumbnailKey: string | null
  key: string | null
  topicId: number
  topicName: string
}

/** A by-camera voting winner photo (top 1-3 by votes) for a topic. */
export interface GalleryByCameraWinnerRow {
  rank: number
  participantReference: string
  submissionId: number
  thumbnailKey: string | null
  key: string | null
  topicId: number
  topicName: string
}

/** A jury-ranked winning participant set (class winners). */
export interface GalleryClassWinnerRow {
  rank: number
  participantReference: string
  competitionClassId: number
  competitionClassName: string
  submissions: GalleryParticipantSubmission[]
}

interface UpsertPublicationInput {
  marathonId: number
  topicId: number | null
  publishedAt: string | null
  featuredSections: GalleryFeaturedSection[]
}

export class GalleryRepository extends Context.Service<
  GalleryRepository,
  {
    /** All gallery publication rows for a marathon (marathon-wide and per-topic). */
    readonly getPublicationsForMarathon: (params: {
      marathonId: number
    }) => Effect.Effect<GalleryPublication[], DbError>
    /** Publication row for a marathon and topic scope (`topicId = null` for marathon-wide), or none. */
    readonly getPublication: (params: {
      marathonId: number
      topicId: number | null
    }) => Effect.Effect<Option.Option<GalleryPublication>, DbError>
    /** Insert or update the publication row for a marathon/topic scope. */
    readonly upsertPublication: (
      params: UpsertPublicationInput,
    ) => Effect.Effect<GalleryPublication, DbError>
    /** Keyset-paginated public feed of uploaded submissions from finalized participants. */
    readonly getFeedPage: (params: {
      marathonId: number
      finalizedStatuses: readonly string[]
      topicId?: number | null
      competitionClassId?: number | null
      cursor?: string | null
      limit: number
    }) => Effect.Effect<GalleryFeedPage, DbError>
    /** Finalized participant with uploaded submissions by reference, or none. */
    readonly getParticipantSet: (params: {
      marathonId: number
      reference: string
      finalizedStatuses: readonly string[]
    }) => Effect.Effect<Option.Option<GalleryParticipantSet>, DbError>
    /** Jury topic winners (rank 1-3) with their submission for the topic. */
    readonly getTopicWinners: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<GalleryTopicWinnerRow[], DbError>
    /** Jury class winners (rank 1-3) with their uploaded submission set. */
    readonly getClassWinners: (params: {
      marathonId: number
      competitionClassId: number
    }) => Effect.Effect<GalleryClassWinnerRow[], DbError>
    /** By-camera voting winners (top 1-3 by votes) for a topic's latest round. */
    readonly getByCameraTopicWinners: (params: {
      marathonId: number
      topicId: number
      limit?: number
    }) => Effect.Effect<GalleryByCameraWinnerRow[], DbError>
  }
>()('@blikka/db/gallery-repository') {}

const makeGalleryRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const getPublicationsForMarathon: GalleryRepository['Service']['getPublicationsForMarathon'] =
    Effect.fn('GalleryRepository.getPublicationsForMarathon')(function* ({ marathonId }) {
      return yield* use((db) =>
        db
          .select()
          .from(galleryPublications)
          .where(eq(galleryPublications.marathonId, marathonId)),
      )
    })

  const getPublication: GalleryRepository['Service']['getPublication'] = Effect.fn(
    'GalleryRepository.getPublication',
  )(function* ({ marathonId, topicId }) {
    const result = yield* use((db) =>
      db.query.galleryPublications.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.marathonId, marathonId),
            topicId === null
              ? operators.isNull(table.topicId)
              : operators.eq(table.topicId, topicId),
          ),
      }),
    )
    return Option.fromNullishOr(result)
  })

  const upsertPublication: GalleryRepository['Service']['upsertPublication'] = Effect.fn(
    'GalleryRepository.upsertPublication',
  )(function* ({ marathonId, topicId, publishedAt, featuredSections }) {
    const existing = yield* getPublication({ marathonId, topicId })
    const nowIso = new Date().toISOString()

    if (Option.isSome(existing)) {
      const [updated] = yield* use((db) =>
        db
          .update(galleryPublications)
          .set({ publishedAt, featuredSections, updatedAt: nowIso })
          .where(eq(galleryPublications.id, existing.value.id))
          .returning(),
      )
      if (!updated) {
        return yield* Effect.fail(new DbError({ message: 'Failed to update gallery publication' }))
      }
      return updated
    }

    const [inserted] = yield* use((db) =>
      db
        .insert(galleryPublications)
        .values({ marathonId, topicId, publishedAt, featuredSections })
        .returning(),
    )
    if (!inserted) {
      return yield* Effect.fail(new DbError({ message: 'Failed to create gallery publication' }))
    }
    return inserted
  })

  const getFeedPage: GalleryRepository['Service']['getFeedPage'] = Effect.fn(
    'GalleryRepository.getFeedPage',
  )(function* ({ marathonId, finalizedStatuses, topicId, competitionClassId, cursor, limit }) {
    const cursorId = cursor ? Number.parseInt(cursor, 10) : undefined
    const hasCursor = cursorId !== undefined && !Number.isNaN(cursorId)

    const conditions = [
      eq(submissions.marathonId, marathonId),
      eq(submissions.status, 'uploaded'),
      inArray(participants.status, [...finalizedStatuses]),
    ]
    if (topicId !== undefined && topicId !== null) {
      conditions.push(eq(submissions.topicId, topicId))
    }
    if (competitionClassId !== undefined && competitionClassId !== null) {
      conditions.push(eq(participants.competitionClassId, competitionClassId))
    }
    if (hasCursor) {
      conditions.push(gt(submissions.id, cursorId!))
    }

    const rows = yield* use((db) =>
      db
        .select({
          submissionId: submissions.id,
          submissionCreatedAt: submissions.createdAt,
          thumbnailKey: submissions.thumbnailKey,
          key: submissions.key,
          topicId: submissions.topicId,
          topicName: topics.name,
          topicOrderIndex: topics.orderIndex,
          participantReference: participants.reference,
          competitionClassId: participants.competitionClassId,
          competitionClassName: competitionClasses.name,
        })
        .from(submissions)
        .innerJoin(participants, eq(participants.id, submissions.participantId))
        .innerJoin(topics, eq(topics.id, submissions.topicId))
        .leftJoin(competitionClasses, eq(competitionClasses.id, participants.competitionClassId))
        .where(and(...conditions))
        .orderBy(asc(submissions.id))
        .limit(limit + 1),
    )

    let nextCursor: string | null = null
    let items = rows
    if (rows.length > limit) {
      items = rows.slice(0, limit)
      const last = items[items.length - 1]
      nextCursor = last ? last.submissionId.toString() : null
    }

    return { items, nextCursor }
  })

  const getParticipantSet: GalleryRepository['Service']['getParticipantSet'] = Effect.fn(
    'GalleryRepository.getParticipantSet',
  )(function* ({ marathonId, reference, finalizedStatuses }) {
    const participant = yield* use((db) =>
      db.query.participants.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.marathonId, marathonId),
            operators.eq(table.reference, reference),
            operators.inArray(table.status, [...finalizedStatuses]),
          ),
        with: {
          competitionClass: true,
          submissions: {
            where: (table, operators) => operators.eq(table.status, 'uploaded'),
            with: { topic: true },
          },
        },
      }),
    )

    if (!participant) {
      return Option.none<GalleryParticipantSet>()
    }

    const submissionRows: GalleryParticipantSubmission[] = participant.submissions
      .map((submission) => ({
        submissionId: submission.id,
        submissionCreatedAt: submission.createdAt,
        thumbnailKey: submission.thumbnailKey,
        key: submission.key,
        topicId: submission.topicId,
        topicName: submission.topic?.name ?? '',
        topicOrderIndex: submission.topic?.orderIndex ?? 0,
      }))
      .toSorted((left, right) => {
        if (left.topicOrderIndex !== right.topicOrderIndex) {
          return left.topicOrderIndex - right.topicOrderIndex
        }
        return left.submissionId - right.submissionId
      })

    return Option.some<GalleryParticipantSet>({
      reference: participant.reference,
      competitionClassId: participant.competitionClassId,
      competitionClassName: participant.competitionClass?.name ?? null,
      submissions: submissionRows,
    })
  })

  const getTopicWinners: GalleryRepository['Service']['getTopicWinners'] = Effect.fn(
    'GalleryRepository.getTopicWinners',
  )(function* ({ marathonId, topicId }) {
    return yield* use((db) =>
      db
        .select({
          rank: juryFinalRankings.rank,
          participantReference: participants.reference,
          submissionId: submissions.id,
          thumbnailKey: submissions.thumbnailKey,
          key: submissions.key,
          topicId: submissions.topicId,
          topicName: topics.name,
        })
        .from(juryFinalRankings)
        .innerJoin(juryInvitations, eq(juryInvitations.id, juryFinalRankings.invitationId))
        .innerJoin(participants, eq(participants.id, juryFinalRankings.participantId))
        .innerJoin(
          submissions,
          and(
            eq(submissions.participantId, participants.id),
            eq(submissions.topicId, topicId),
            eq(submissions.status, 'uploaded'),
          ),
        )
        .innerJoin(topics, eq(topics.id, submissions.topicId))
        .where(
          and(
            eq(juryFinalRankings.marathonId, marathonId),
            eq(juryInvitations.inviteType, 'topic'),
            eq(juryInvitations.topicId, topicId),
          ),
        )
        .orderBy(asc(juryFinalRankings.rank), asc(submissions.id)),
    )
  })

  const getClassWinners: GalleryRepository['Service']['getClassWinners'] = Effect.fn(
    'GalleryRepository.getClassWinners',
  )(function* ({ marathonId, competitionClassId }) {
    const rankedParticipants = yield* use((db) =>
      db
        .select({
          rank: juryFinalRankings.rank,
          participantId: participants.id,
          participantReference: participants.reference,
          competitionClassName: competitionClasses.name,
        })
        .from(juryFinalRankings)
        .innerJoin(juryInvitations, eq(juryInvitations.id, juryFinalRankings.invitationId))
        .innerJoin(participants, eq(participants.id, juryFinalRankings.participantId))
        .innerJoin(competitionClasses, eq(competitionClasses.id, participants.competitionClassId))
        .where(
          and(
            eq(juryFinalRankings.marathonId, marathonId),
            eq(juryInvitations.inviteType, 'class'),
            eq(juryInvitations.competitionClassId, competitionClassId),
            eq(participants.competitionClassId, competitionClassId),
          ),
        )
        .orderBy(asc(juryFinalRankings.rank)),
    )

    if (rankedParticipants.length === 0) {
      return []
    }

    const participantIds = rankedParticipants.map((row) => row.participantId)
    const winnerSubmissions = yield* use((db) =>
      db
        .select({
          participantId: submissions.participantId,
          submissionId: submissions.id,
          submissionCreatedAt: submissions.createdAt,
          thumbnailKey: submissions.thumbnailKey,
          key: submissions.key,
          topicId: submissions.topicId,
          topicName: topics.name,
          topicOrderIndex: topics.orderIndex,
        })
        .from(submissions)
        .innerJoin(topics, eq(topics.id, submissions.topicId))
        .where(
          and(
            eq(submissions.marathonId, marathonId),
            eq(submissions.status, 'uploaded'),
            inArray(submissions.participantId, participantIds),
          ),
        )
        .orderBy(asc(topics.orderIndex), asc(submissions.id)),
    )

    const submissionsByParticipant = new Map<number, GalleryParticipantSubmission[]>()
    for (const submission of winnerSubmissions) {
      const list = submissionsByParticipant.get(submission.participantId) ?? []
      list.push({
        submissionId: submission.submissionId,
        submissionCreatedAt: submission.submissionCreatedAt,
        thumbnailKey: submission.thumbnailKey,
        key: submission.key,
        topicId: submission.topicId,
        topicName: submission.topicName,
        topicOrderIndex: submission.topicOrderIndex,
      })
      submissionsByParticipant.set(submission.participantId, list)
    }

    return rankedParticipants.map((row) => ({
      rank: row.rank,
      participantReference: row.participantReference,
      competitionClassId,
      competitionClassName: row.competitionClassName,
      submissions: submissionsByParticipant.get(row.participantId) ?? [],
    }))
  })

  const getByCameraTopicWinners: GalleryRepository['Service']['getByCameraTopicWinners'] =
    Effect.fn('GalleryRepository.getByCameraTopicWinners')(function* ({
      marathonId,
      topicId,
      limit = 3,
    }) {
      const latestRound = yield* use((db) =>
        db.query.votingRound.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.marathonId, marathonId),
              operators.eq(table.topicId, topicId),
            ),
          orderBy: (table, operators) => [
            operators.desc(table.roundNumber),
            operators.desc(table.id),
          ],
          columns: { id: true },
        }),
      )

      if (!latestRound) {
        return []
      }

      const roundId = latestRound.id

      const rows = yield* use((db) => {
        const leaderboard = db
          .select({
            submissionId: sql<number>`${submissions.id}`.as('submission_id'),
            thumbnailKey: submissions.thumbnailKey,
            key: submissions.key,
            topicId: submissions.topicId,
            topicName: topics.name,
            participantReference: participants.reference,
            voteCount: sql<number>`count(${votingRoundVote.id})`.as('vote_count'),
          })
          .from(votingRoundSubmission)
          .innerJoin(submissions, eq(submissions.id, votingRoundSubmission.submissionId))
          .innerJoin(participants, eq(participants.id, submissions.participantId))
          .innerJoin(topics, eq(topics.id, submissions.topicId))
          .leftJoin(
            votingRoundVote,
            and(
              eq(votingRoundVote.roundId, votingRoundSubmission.roundId),
              eq(votingRoundVote.submissionId, submissions.id),
            ),
          )
          .where(
            and(eq(votingRoundSubmission.roundId, roundId), eq(submissions.status, 'uploaded')),
          )
          .groupBy(
            submissions.id,
            submissions.thumbnailKey,
            submissions.key,
            submissions.topicId,
            topics.name,
            participants.reference,
          )
          .as('by_camera_leaderboard')

        const ranked = db
          .select({
            submissionId: leaderboard.submissionId,
            thumbnailKey: leaderboard.thumbnailKey,
            key: leaderboard.key,
            topicId: leaderboard.topicId,
            topicName: leaderboard.topicName,
            participantReference: leaderboard.participantReference,
            rank: sql<number>`rank() over (order by ${leaderboard.voteCount} desc)`.as('rank'),
          })
          .from(leaderboard)
          .as('ranked_by_camera')

        return db
          .select({
            rank: ranked.rank,
            participantReference: ranked.participantReference,
            submissionId: ranked.submissionId,
            thumbnailKey: ranked.thumbnailKey,
            key: ranked.key,
            topicId: ranked.topicId,
            topicName: ranked.topicName,
          })
          .from(ranked)
          .where(sql`${ranked.rank} <= ${limit}`)
          .orderBy(asc(ranked.rank), asc(ranked.submissionId))
      })

      return rows
    })

  return GalleryRepository.of({
    getPublicationsForMarathon,
    getPublication,
    upsertPublication,
    getFeedPage,
    getParticipantSet,
    getTopicWinners,
    getClassWinners,
    getByCameraTopicWinners,
  })
})

export const GalleryRepositoryLayerNoDeps = Layer.effect(GalleryRepository, makeGalleryRepository)

export const GalleryRepositoryLayer = GalleryRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
