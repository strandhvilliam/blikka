import { DrizzleClient } from "../drizzle-client"
import { Effect, Layer, Option, Context } from "effect"
import { eq, and } from "drizzle-orm"
import {
  juryFinalRankings,
  juryInvitations,
  juryRatings,
  marathons,
  participants,
  submissions,
} from "../schema"
import type {
  CompetitionClass,
  DeviceGroup,
  JuryFinalRanking,
  JuryInvitation,
  JuryRating,
  Marathon,
  NewJuryInvitation,
  Participant,
  Submission,
  Topic,
} from "../types"
import { DbError } from "../utils"

type JuryParticipantPublicFields = Pick<Participant, "id" | "reference" | "firstname" | "lastname">

interface JuryInvitationWithOptions extends JuryInvitation {
  topic: Topic | null
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
}

/** Invitation row with topic/class/device relations and marathon from token resolution. */
type JuryInvitationWithMarathon = JuryInvitationWithOptions & { marathon: Marathon }

/** Single participant row in jury submission list endpoints. */
type JurySubmissionListParticipant = Pick<
  Participant,
  "id" | "createdAt" | "status" | "reference"
> & {
  submission: Submission & { topic: Topic | null }
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
}

type JurySubmissionListPage = {
  participants: JurySubmissionListParticipant[]
  nextCursor: number | null
}

type JuryRatingRecentWithParticipant = JuryRating & {
  participant: JuryParticipantPublicFields
}

type JuryFinalRankingWithParticipant = JuryFinalRanking & {
  participant: JuryParticipantPublicFields
}

interface JuryRatingWithParticipant extends JuryRating {
  finalRanking: number | null
  participant: JuryParticipantPublicFields
}

export class JuryRepository extends Context.Service<
  JuryRepository,
  {
  /** Jury invitations belonging to a marathon. */
  readonly getJuryInvitationsByMarathonId: (params: {
    id: number
  }) => Effect.Effect<JuryInvitation[], DbError>
  /** Jury invitation row by primary key, or none if missing. */
  readonly getJuryInvitationById: (params: {
    id: number
  }) => Effect.Effect<Option.Option<JuryInvitationWithOptions>, DbError>
  /** Jury invitations for the marathon identified by domain. */
  readonly getJuryInvitationsByDomain: (params: {
    domain: string
  }) => Effect.Effect<JuryInvitationWithOptions[], DbError>
  /** Insert a new jury invitation row. */
  readonly createJuryInvitation: (params: {
    data: NewJuryInvitation
  }) => Effect.Effect<{ id: number }, DbError>
  /** Patch fields on a jury invitation identified by id. */
  readonly updateJuryInvitation: (params: {
    id: number
    data: Partial<NewJuryInvitation>
  }) => Effect.Effect<JuryInvitation, DbError>
  /** Delete a jury invitation by id. */
  readonly deleteJuryInvitation: (params: {
    id: number
  }) => Effect.Effect<JuryInvitation, DbError>
  /** Resolve public jury data from a token payload. */
  readonly getJuryDataByTokenPayload: (params: {
    domain: string
    invitationId: number
  }) => Effect.Effect<JuryInvitationWithMarathon, DbError>
  /** Jury submissions for a token payload with filters. */
  readonly getJurySubmissionsFromToken: (params: {
    invitationId: number
    cursor?: number
    ratingFilter?: number[]
  }) => Effect.Effect<JurySubmissionListPage, DbError>
  /** Jury submissions for an invitation without rating filters. */
  readonly getJurySubmissionsWithoutFilters: (params: {
    invitation: any
    cursor?: number
  }) => Effect.Effect<JurySubmissionListPage, DbError>
  /** Jury submissions for an invitation with rating filters. */
  readonly getJurySubmissionsWithRatingFilters: (params: {
    invitation: any
    ratingFilter: number[]
    cursor?: number
  }) => Effect.Effect<JurySubmissionListPage, DbError>
  /** Statistics for a jury invitation. */
  readonly getJuryInvitationStatistics: (params: { invitationId: number }) => Effect.Effect<
    {
      totalParticipants: number
      ratedParticipants: number
      progressPercentage: number
      averageRating: number
      ratingDistribution: { rating: number; count: number }[]
      recentRatings: JuryRatingRecentWithParticipant[]
    },
    DbError
  >
  /** Participant count visible to a jury invitation. */
  readonly getJuryParticipantCount: (params: {
    invitationId: number
    ratingFilter?: number[]
  }) => Effect.Effect<{ value: number }, DbError>
  /** Rating by invitation and participant, or none if missing. */
  readonly getJuryRating: (params: {
    invitationId: number
    participantId: number
  }) => Effect.Effect<Option.Option<JuryRating>, DbError>
  /** Ratings belonging to a jury invitation. */
  readonly getJuryRatingsByInvitation: (params: {
    invitationId: number
  }) => Effect.Effect<JuryRatingWithParticipant[], DbError>
  /** Ratings and rankings belonging to a jury invitation. */
  readonly getJuryRatingsWithRankingsByInvitation: (params: {
    invitationId: number
  }) => Effect.Effect<JuryRatingWithParticipant[], DbError>
  /** Final rankings assigned by a jury invitation. */
  readonly getJuryAssignedFinalRankings: (params: {
    invitationId: number
  }) => Effect.Effect<JuryFinalRankingWithParticipant[], DbError>
  /** Whether a participant is within a jury invitation's scope. */
  readonly participantMatchesInvitationScope: (params: {
    invitationId: number
    participantId: number
  }) => Effect.Effect<boolean, DbError>
  /** Insert a new jury rating row. */
  readonly createJuryRating: (params: {
    invitationId: number
    participantId: number
    rating: number
    notes?: string
  }) => Effect.Effect<JuryRating, DbError>
  /** Patch a jury rating by invitation and participant. */
  readonly updateJuryRating: (params: {
    invitationId: number
    participantId: number
    rating: number
    notes?: string
  }) => Effect.Effect<JuryRating, DbError>
  /** Final ranking by invitation and participant, or null if missing. */
  readonly getJuryFinalRankingByParticipant: (params: {
    invitationId: number
    participantId: number
  }) => Effect.Effect<JuryFinalRanking | null, DbError>
  /** Final ranking by invitation and rank, or null if missing. */
  readonly getJuryFinalRankingByRank: (params: {
    invitationId: number
    rank: number
    excludeParticipantId?: number
  }) => Effect.Effect<JuryFinalRanking | null, DbError>
  /** Insert a new jury final ranking row. */
  readonly createJuryFinalRanking: (params: {
    invitationId: number
    participantId: number
    rank: number
  }) => Effect.Effect<JuryFinalRanking, DbError>
  /** Patch a jury final ranking by invitation and participant. */
  readonly updateJuryFinalRanking: (params: {
    invitationId: number
    participantId: number
    rank: number
  }) => Effect.Effect<JuryFinalRanking, DbError>
  /** Delete a jury final ranking by invitation and participant. */
  readonly deleteJuryFinalRankingByParticipant: (params: {
    invitationId: number
    participantId: number
  }) => Effect.Effect<JuryFinalRanking[], DbError>
  /** Delete a jury rating by invitation and participant. */
  readonly deleteJuryRating: (params: {
    invitationId: number
    participantId: number
  }) => Effect.Effect<Option.Option<JuryRating[]>, DbError>
}
>()("@blikka/db/jury-repository") {}

const makeJuryRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient
  const getJuryInvitationsByMarathonId: JuryRepository["Service"]["getJuryInvitationsByMarathonId"] =
    Effect.fn("JuryRepository.getJuryInvitatinosByMarathonId")(function* ({ id }) {
      const result = yield* use((db) =>
        db.query.juryInvitations.findMany({
          where: (table, operators) => operators.eq(table.marathonId, id),
          orderBy: (table, operators) => operators.desc(table.createdAt),
        }),
      )
      return result
    })
  const getJuryInvitationById: JuryRepository["Service"]["getJuryInvitationById"] = Effect.fn(
    "JuryRepository.getJuryInvitationById",
  )(function* ({ id }) {
    const result = yield* use((db) =>
      db.query.juryInvitations.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
        with: {
          topic: true,
          competitionClass: true,
          deviceGroup: true,
        },
      }),
    )
    return Option.fromNullishOr(result)
  })
  const getJuryInvitationsByDomain: JuryRepository["Service"]["getJuryInvitationsByDomain"] =
    Effect.fn("JuryRepository.getJuryInvitationsByDomain")(function* ({ domain }) {
      const marathon = yield* use((db) =>
        db
          .select({ id: marathons.id })
          .from(marathons)
          .where(eq(marathons.domain, domain))
          .limit(1),
      )
      if (!marathon.length) {
        return []
      }
      const marathonId = marathon[0]!.id
      const result = yield* use((db) =>
        db.query.juryInvitations.findMany({
          where: (table, operators) => operators.eq(table.marathonId, marathonId),
          orderBy: (table, operators) => operators.desc(table.createdAt),
          with: {
            competitionClass: true,
            deviceGroup: true,
            topic: true,
          },
        }),
      )
      return result
    })

  const createJuryInvitation: JuryRepository["Service"]["createJuryInvitation"] = Effect.fn(
    "JuryRepository.createJuryInvitation",
  )(function* ({ data }) {
    const [result] = yield* use((db) =>
      db.insert(juryInvitations).values(data).returning({ id: juryInvitations.id }),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to create jury invitation",
        }),
      )
    }
    return result
  })

  const updateJuryInvitation: JuryRepository["Service"]["updateJuryInvitation"] = Effect.fn(
    "JuryRepository.updateJuryInvitation",
  )(function* ({ id, data }) {
    const [result] = yield* use((db) =>
      db.update(juryInvitations).set(data).where(eq(juryInvitations.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to update jury invitation",
        }),
      )
    }
    return result
  })
  const deleteJuryInvitation: JuryRepository["Service"]["deleteJuryInvitation"] = Effect.fn(
    "JuryRepository.deleteJuryInvitation",
  )(function* ({ id }) {
    const [result] = yield* use((db) =>
      db.delete(juryInvitations).where(eq(juryInvitations.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to delete jury invitation",
        }),
      )
    }
    return result
  })
  const getJuryDataByTokenPayload: JuryRepository["Service"]["getJuryDataByTokenPayload"] =
    Effect.fn("JuryRepository.getJuryDataByToken")(function* ({ domain, invitationId }) {
      const invitation = yield* use((db) =>
        db.query.juryInvitations.findFirst({
          where: (table, operators) => operators.eq(table.id, invitationId),
          with: {
            competitionClass: true,
            deviceGroup: true,
            topic: true,
            marathon: true,
          },
        }),
      )
      if (!invitation) {
        return yield* Effect.fail(
          new DbError({
            message: "Invitation not found",
          }),
        )
      }
      const marathon = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
        }),
      )
      if (!marathon || invitation.marathonId !== marathon.id) {
        return yield* Effect.fail(
          new DbError({
            message: "Marathon not found",
          }),
        )
      }
      return invitation
    })

  const createJuryRating: JuryRepository["Service"]["createJuryRating"] = Effect.fn(
    "JuryRepository.createJuryRating",
  )(function* ({ invitationId, participantId, rating, notes }) {
    const invitation = yield* use((db) =>
      db.query.juryInvitations.findFirst({
        where: (table, operators) => operators.eq(table.id, invitationId),
      }),
    )
    if (!invitation) {
      return yield* Effect.fail(
        new DbError({
          message: "Invitation not found",
        }),
      )
    }
    const [result] = yield* use((db) =>
      db
        .insert(juryRatings)
        .values({
          invitationId,
          participantId,
          rating,
          notes: notes || "",
          marathonId: invitation.marathonId,
        })
        .returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to create jury rating",
        }),
      )
    }
    return result
  })
  const updateJuryRating: JuryRepository["Service"]["updateJuryRating"] = Effect.fn(
    "JuryRepository.updateJuryRating",
  )(function* ({ invitationId, participantId, rating, notes }) {
    const [result] = yield* use((db) =>
      db
        .update(juryRatings)
        .set({
          rating,
          notes: notes || "",
        })
        .where(
          and(
            eq(juryRatings.invitationId, invitationId),
            eq(juryRatings.participantId, participantId),
          ),
        )
        .returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Jury rating not found",
        }),
      )
    }
    return result
  })
  const getJuryFinalRankingByParticipant: JuryRepository["Service"]["getJuryFinalRankingByParticipant"] =
    Effect.fn("JuryRepository.getJuryFinalRankingByParticipant")(function* ({
      invitationId,
      participantId,
    }) {
      const existing = yield* use((db) =>
        db.query.juryFinalRankings.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.invitationId, invitationId),
              operators.eq(table.participantId, participantId),
            ),
        }),
      )
      return existing ?? null
    })
  const getJuryFinalRankingByRank: JuryRepository["Service"]["getJuryFinalRankingByRank"] =
    Effect.fn("JuryRepository.getJuryFinalRankingByRank")(function* ({
      invitationId,
      rank,
      excludeParticipantId,
    }) {
      const existing = yield* use((db) =>
        db.query.juryFinalRankings.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.invitationId, invitationId),
              operators.eq(table.rank, rank),
              ...(excludeParticipantId === undefined
                ? []
                : [operators.ne(table.participantId, excludeParticipantId)]),
            ),
        }),
      )
      return existing ?? null
    })
  const createJuryFinalRanking: JuryRepository["Service"]["createJuryFinalRanking"] = Effect.fn(
    "JuryRepository.createJuryFinalRanking",
  )(function* ({ invitationId, participantId, rank }) {
    const invitation = yield* use((db) =>
      db.query.juryInvitations.findFirst({
        where: (table, operators) => operators.eq(table.id, invitationId),
      }),
    )
    if (!invitation) {
      return yield* Effect.fail(
        new DbError({
          message: "Invitation not found",
        }),
      )
    }
    const [result] = yield* use((db) =>
      db
        .insert(juryFinalRankings)
        .values({
          invitationId,
          participantId,
          rank,
          marathonId: invitation.marathonId,
        })
        .returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to create jury final ranking",
        }),
      )
    }
    return result
  })
  const updateJuryFinalRanking: JuryRepository["Service"]["updateJuryFinalRanking"] = Effect.fn(
    "JuryRepository.updateJuryFinalRanking",
  )(function* ({ invitationId, participantId, rank }) {
    const [result] = yield* use((db) =>
      db
        .update(juryFinalRankings)
        .set({ rank })
        .where(
          and(
            eq(juryFinalRankings.invitationId, invitationId),
            eq(juryFinalRankings.participantId, participantId),
          ),
        )
        .returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Jury final ranking not found",
        }),
      )
    }
    return result
  })
  const deleteJuryFinalRankingByParticipant: JuryRepository["Service"]["deleteJuryFinalRankingByParticipant"] =
    Effect.fn("JuryRepository.deleteJuryFinalRankingByParticipant")(function* ({
      invitationId,
      participantId,
    }: {
      invitationId: number
      participantId: number
    }) {
      const result = yield* use((db) =>
        db
          .delete(juryFinalRankings)
          .where(
            and(
              eq(juryFinalRankings.invitationId, invitationId),
              eq(juryFinalRankings.participantId, participantId),
            ),
          )
          .returning(),
      )
      return result
    })
  const getJuryRating: JuryRepository["Service"]["getJuryRating"] = Effect.fn(
    "JuryRepository.getJuryRating",
  )(function* ({ invitationId, participantId }) {
    const invitation = yield* use((db) =>
      db.query.juryInvitations.findFirst({
        where: (table, operators) => operators.eq(table.id, invitationId),
      }),
    )
    if (!invitation) {
      return yield* Effect.fail(
        new DbError({
          message: "Invitation not found",
        }),
      )
    }
    const result = yield* use((db) =>
      db.query.juryRatings.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.invitationId, invitationId),
            operators.eq(table.participantId, participantId),
          ),
      }),
    )
    return Option.fromNullishOr(result)
  })
  const getJuryRatingsWithRankingsByInvitation: JuryRepository["Service"]["getJuryRatingsWithRankingsByInvitation"] =
    Effect.fn("JuryRepository.getJuryRatingsWithRankingsByInvitation")(function* ({
      invitationId,
    }) {
      const invitation = yield* use((db) =>
        db.query.juryInvitations.findFirst({
          where: (table, operators) => operators.eq(table.id, invitationId),
        }),
      )
      if (!invitation) {
        return yield* Effect.fail(
          new DbError({
            message: "Invitation not found",
          }),
        )
      }
      const ratings = yield* use((db) =>
        db.query.juryRatings.findMany({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.invitationId, invitation.id),
              operators.eq(table.marathonId, invitation.marathonId),
            ),
          with: {
            participant: {
              columns: {
                id: true,
                reference: true,
                firstname: true,
                lastname: true,
              },
            },
          },
          orderBy: (table, operators) => operators.desc(table.createdAt),
        }),
      )
      const finalRankings = yield* use((db) =>
        db.query.juryFinalRankings.findMany({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.invitationId, invitation.id),
              operators.eq(table.marathonId, invitation.marathonId),
            ),
          with: {
            participant: {
              columns: {
                id: true,
                reference: true,
                firstname: true,
                lastname: true,
              },
            },
          },
          orderBy: (table, operators) => operators.asc(table.rank),
        }),
      )

      const rankingByParticipantId = new Map<number, JuryFinalRanking>()
      for (const ranking of finalRankings) {
        rankingByParticipantId.set(ranking.participantId, ranking)
      }

      const merged = ratings.map((rating) => ({
        ...rating,
        finalRanking: rankingByParticipantId.get(rating.participantId)?.rank ?? null,
      }))

      const ratingsByParticipantId = new Set(ratings.map((rating) => rating.participantId))

      for (const ranking of finalRankings) {
        if (ratingsByParticipantId.has(ranking.participantId)) {
          continue
        }

        merged.push({
          id: 0,
          createdAt: ranking.createdAt,
          invitationId: ranking.invitationId,
          rating: 0,
          participantId: ranking.participantId,
          notes: "",
          marathonId: ranking.marathonId,
          participant: ranking.participant,
          finalRanking: ranking.rank,
        })
      }

      return merged.toSorted((left, right) => {
        const rankDiff = (left.finalRanking ?? 99) - (right.finalRanking ?? 99)
        if (rankDiff !== 0) {
          return rankDiff
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
    })
  const deleteJuryRating: JuryRepository["Service"]["deleteJuryRating"] = Effect.fn(
    "JuryRepository.deleteJuryRating",
  )(function* ({ invitationId, participantId }) {
    const invitation = yield* use((db) =>
      db.query.juryInvitations.findFirst({
        where: (table, operators) => operators.eq(table.id, invitationId),
      }),
    )
    if (!invitation) {
      return yield* Effect.fail(
        new DbError({
          message: "Invitation not found",
        }),
      )
    }
    const result = yield* use((db) =>
      db
        .delete(juryRatings)
        .where(
          and(
            eq(juryRatings.invitationId, invitationId),
            eq(juryRatings.participantId, participantId),
          ),
        )
        .returning(),
    )
    return Option.fromNullishOr(result)
  })
  const getJurySubmissionsWithoutFilters: JuryRepository["Service"]["getJurySubmissionsWithoutFilters"] =
    Effect.fn("JuryRepository.getJurySubmissionWithouFilters")(function* ({ invitation, cursor }) {
      const limit = 50
      if (invitation.inviteType === "topic") {
        const topicId = invitation.topicId!
        if (!topicId) {
          return yield* Effect.fail(
            new DbError({
              message: "Topic not found",
            }),
          )
        }
        let cursorSubmission: Submission | null = null
        if (cursor) {
          const [sub] = yield* use((db) =>
            db.select().from(submissions).where(eq(submissions.id, cursor)).limit(1),
          )
          if (sub) {
            cursorSubmission = sub
          }
        }
        const topicSubmissions = yield* use((db) =>
          db.query.submissions.findMany({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, invitation.marathonId),
                operators.eq(table.topicId, topicId),
                ...(cursorSubmission
                  ? [operators.lt(table.createdAt, cursorSubmission.createdAt)]
                  : []),
              ),
            with: {
              topic: true,
              participant: {
                columns: {
                  id: true,
                  createdAt: true,
                  reference: true,
                  status: true,
                },
                with: {
                  competitionClass: true,
                  deviceGroup: true,
                },
              },
            },
            limit: limit + 1,
            orderBy: (table, operators) => operators.desc(table.createdAt),
          }),
        )
        let nextCursor: number | null = null
        if (topicSubmissions.length > limit) {
          topicSubmissions.pop()
          const lastSubmission = topicSubmissions.at(-1)
          nextCursor = lastSubmission!.id
        }
        const mapped = topicSubmissions.map((submission) => {
          const { participant, ...rest } = submission
          return {
            ...participant,
            submission: rest,
          }
        })
        return {
          participants: mapped,
          nextCursor,
        }
      } else if (invitation.inviteType === "class") {
        if (!invitation.competitionClassId) {
          return yield* Effect.fail(
            new DbError({
              message: "Class not found",
            }),
          )
        }
        let cursorParticipant: Participant | null = null
        if (cursor) {
          const [participant] = yield* use((db) =>
            db.select().from(participants).where(eq(participants.id, cursor)).limit(1),
          )
          if (participant) {
            cursorParticipant = participant
          }
        }
        const participantsInCompetitionClass = yield* use((db) =>
          db.query.participants.findMany({
            columns: {
              id: true,
              createdAt: true,
              reference: true,
              status: true,
            },
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, invitation.marathonId),
                operators.eq(table.competitionClassId, invitation.competitionClassId),
                ...(invitation.deviceGroupId === null || invitation.deviceGroupId === undefined
                  ? []
                  : [operators.eq(table.deviceGroupId, invitation.deviceGroupId)]),
                ...(cursorParticipant
                  ? [operators.lt(table.createdAt, cursorParticipant.createdAt)]
                  : []),
              ),
            with: {
              competitionClass: true,
              deviceGroup: true,
            },
            limit: limit + 1,
            orderBy: (table, operators) => operators.desc(table.createdAt),
          }),
        )
        let nextCursor: number | null = null
        if (participantsInCompetitionClass.length > limit) {
          participantsInCompetitionClass.pop()
          const lastParticipant = participantsInCompetitionClass.at(-1)
          nextCursor = lastParticipant!.id
        }
        const mapped = participantsInCompetitionClass.map((participant) => {
          return {
            ...participant,
            submission: null as unknown as Submission & {
              topic: Topic | null
            },
          }
        })
        return {
          participants: mapped,
          nextCursor,
        }
      } else {
        return yield* Effect.fail(
          new DbError({
            message: "Invitation type not found",
          }),
        )
      }
    })
  const getJurySubmissionsWithRatingFilters: JuryRepository["Service"]["getJurySubmissionsWithRatingFilters"] =
    Effect.fn("JuryRepository.getJurySubmissionsWithRatingFilters")(function* ({
      invitation,
      ratingFilter,
      cursor,
    }) {
      const limit = 50
      const allRatings = yield* use((db) =>
        db.query.juryRatings.findMany({
          where: (table, operators) => operators.eq(table.invitationId, invitation.id),
        }),
      )
      const ratingMap = new Map<number, number>()
      allRatings.forEach((rating) => {
        ratingMap.set(rating.participantId, rating.rating)
      })
      const filteredParticipantIds = Array.from(ratingMap.entries())
        .filter(([_, rating]) => ratingFilter.includes(rating))
        .map(([participantId]) => participantId)
      if (ratingFilter.includes(0)) {
        if (invitation.inviteType === "topic") {
          const topicId = invitation.topicId
          if (!topicId) {
            return yield* Effect.fail(
              new DbError({
                message: "Topic not found",
              }),
            )
          }

          const allTopicParticipants = yield* use((db) =>
            db
              .selectDistinct({ participantId: submissions.participantId })
              .from(submissions)
              .where(
                and(
                  eq(submissions.marathonId, invitation.marathonId),
                  eq(submissions.topicId, topicId),
                ),
              ),
          )
          allTopicParticipants.forEach((p) => {
            if (!ratingMap.has(p.participantId)) {
              filteredParticipantIds.push(p.participantId)
            }
          })
        } else if (invitation.inviteType === "class") {
          const allClassParticipants = yield* use((db) =>
            db
              .select({ id: participants.id })
              .from(participants)
              .where(
                and(
                  eq(participants.marathonId, invitation.marathonId),
                  eq(participants.competitionClassId, invitation.competitionClassId),
                ),
              ),
          )
          allClassParticipants.forEach((p) => {
            if (!ratingMap.has(p.id)) {
              filteredParticipantIds.push(p.id)
            }
          })
        }
      }
      if (filteredParticipantIds.length === 0) {
        return {
          participants: [],
          nextCursor: null,
        }
      }
      const offset = cursor || 0
      if (invitation.inviteType === "topic") {
        const topicId = invitation.topicId
        if (!topicId) {
          return yield* Effect.fail(
            new DbError({
              message: "Topic not found",
            }),
          )
        }

        const topicSubmissions = yield* use((db) =>
          db.query.submissions.findMany({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, invitation.marathonId),
                operators.eq(table.topicId, topicId),
              ),
            with: {
              topic: true,
              participant: {
                columns: {
                  id: true,
                  createdAt: true,
                  reference: true,
                  status: true,
                },
                with: {
                  competitionClass: true,
                  deviceGroup: true,
                },
              },
            },
            orderBy: (table, operators) => operators.desc(table.createdAt),
          }),
        )
        const filteredSubmissions = topicSubmissions.filter(
          (submission) =>
            submission.participant && filteredParticipantIds.includes(submission.participant.id),
        )
        const paginatedSubmissions = filteredSubmissions.slice(offset, offset + limit + 1)
        let nextCursor: number | null = null
        if (paginatedSubmissions.length > limit) {
          paginatedSubmissions.pop()
          nextCursor = offset + limit
        }
        const mapped = paginatedSubmissions.map((submission) => {
          const { participant, ...rest } = submission
          return {
            ...participant,
            submission: rest,
          }
        })
        return {
          participants: mapped,
          nextCursor,
        }
      } else if (invitation.inviteType === "class") {
        const participantsInCompetitionClass = yield* use((db) =>
          db.query.participants.findMany({
            columns: {
              id: true,
              createdAt: true,
              reference: true,
              status: true,
            },
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, invitation.marathonId),
                operators.eq(table.competitionClassId, invitation.competitionClassId),
                ...(invitation.deviceGroupId === null || invitation.deviceGroupId === undefined
                  ? []
                  : [operators.eq(table.deviceGroupId, invitation.deviceGroupId)]),
              ),
            with: {
              competitionClass: true,
              deviceGroup: true,
            },
            orderBy: (table, operators) => operators.desc(table.createdAt),
          }),
        )
        const filteredParticipants = participantsInCompetitionClass.filter((participant) =>
          filteredParticipantIds.includes(participant.id),
        )
        const paginatedParticipants = filteredParticipants.slice(offset, offset + limit + 1)
        let nextCursor: number | null = null
        if (paginatedParticipants.length > limit) {
          paginatedParticipants.pop()
          nextCursor = offset + limit
        }
        const mapped = paginatedParticipants.map((participant) => {
          return {
            ...participant,
            submission: null as unknown as Submission & {
              topic: Topic | null
            },
          }
        })
        return {
          participants: mapped,
          nextCursor,
        }
      } else {
        return yield* Effect.fail(
          new DbError({
            message: "Invitation type not found",
          }),
        )
      }
    })
  const getJurySubmissionsFromToken: JuryRepository["Service"]["getJurySubmissionsFromToken"] =
    Effect.fn("JuryRepository.getJurySubmissionsFromToken")(function* ({
      invitationId,
      cursor,
      ratingFilter,
    }) {
      const invitation = yield* use((db) =>
        db.query.juryInvitations.findFirst({
          where: (table, operators) => operators.eq(table.id, invitationId),
        }),
      )
      if (!invitation) {
        return yield* Effect.fail(
          new DbError({
            message: "Invitation not found",
          }),
        )
      }
      if (ratingFilter && ratingFilter.length > 0) {
        return yield* getJurySubmissionsWithRatingFilters({
          invitation,
          ratingFilter,
          cursor,
        })
      } else {
        return yield* getJurySubmissionsWithoutFilters({
          invitation,
          cursor,
        })
      }
    })
  const getJuryRatingsByInvitation: JuryRepository["Service"]["getJuryRatingsByInvitation"] =
    Effect.fn("JuryRepository.getJuryRatingsByInvitation")(function* ({ invitationId }) {
      const ratings = yield* getJuryRatingsWithRankingsByInvitation({
        invitationId,
      })
      return ratings
    })
  const getJuryAssignedFinalRankings: JuryRepository["Service"]["getJuryAssignedFinalRankings"] =
    Effect.fn("JuryRepository.getJuryAssignedFinalRankings")(function* ({ invitationId }) {
      const invitation = yield* use((db) =>
        db.query.juryInvitations.findFirst({
          where: (table, operators) => operators.eq(table.id, invitationId),
        }),
      )
      if (!invitation) {
        return yield* Effect.fail(
          new DbError({
            message: "Invitation not found",
          }),
        )
      }
      return yield* use((db) =>
        db.query.juryFinalRankings.findMany({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.invitationId, invitation.id),
              operators.eq(table.marathonId, invitation.marathonId),
            ),
          with: {
            participant: {
              columns: {
                id: true,
                reference: true,
                firstname: true,
                lastname: true,
              },
            },
          },
          orderBy: (table, operators) => operators.asc(table.rank),
        }),
      )
    })
  const participantMatchesInvitationScope: JuryRepository["Service"]["participantMatchesInvitationScope"] =
    Effect.fn("JuryRepository.participantMatchesInvitationScope")(function* ({
      invitationId,
      participantId,
    }) {
      const invitation = yield* use((db) =>
        db.query.juryInvitations.findFirst({
          where: (table, operators) => operators.eq(table.id, invitationId),
        }),
      )
      if (!invitation) {
        return yield* Effect.fail(
          new DbError({
            message: "Invitation not found",
          }),
        )
      }

      if (invitation.inviteType === "topic") {
        if (!invitation.topicId) {
          return yield* Effect.fail(
            new DbError({
              message: "Topic not found",
            }),
          )
        }

        const topicId = invitation.topicId

        const [match] = yield* use((db) =>
          db
            .select({ participantId: submissions.participantId })
            .from(submissions)
            .where(
              and(
                eq(submissions.marathonId, invitation.marathonId),
                eq(submissions.topicId, topicId),
                eq(submissions.participantId, participantId),
                eq(submissions.status, "uploaded"),
              ),
            )
            .limit(1),
        )

        return Boolean(match)
      }

      if (!invitation.competitionClassId) {
        return yield* Effect.fail(
          new DbError({
            message: "Class not found",
          }),
        )
      }

      const competitionClassId = invitation.competitionClassId!

      const [match] = yield* use((db) =>
        db
          .select({ id: participants.id })
          .from(participants)
          .where(
            and(
              eq(participants.id, participantId),
              eq(participants.marathonId, invitation.marathonId),
              eq(participants.competitionClassId, competitionClassId),
              ...(invitation.deviceGroupId === null || invitation.deviceGroupId === undefined
                ? []
                : [eq(participants.deviceGroupId, invitation.deviceGroupId)]),
            ),
          )
          .limit(1),
      )

      return Boolean(match)
    })
  const getJuryParticipantCount: JuryRepository["Service"]["getJuryParticipantCount"] = Effect.fn(
    "JuryRepository.getJuryParticipantCount",
  )(function* ({ invitationId, ratingFilter }) {
    const invitation = yield* use((db) =>
      db.query.juryInvitations.findFirst({
        where: (table, operators) => operators.eq(table.id, invitationId),
      }),
    )
    if (!invitation) {
      return yield* Effect.fail(
        new DbError({
          message: "Invitation not found",
        }),
      )
    }
    let participantIds: Array<{ participantId: number }>

    if (invitation.inviteType === "topic") {
      const topicId = invitation.topicId
      if (!topicId) {
        return yield* Effect.fail(
          new DbError({
            message: "Topic not found",
          }),
        )
      }

      participantIds = (yield* use((db) =>
        db
          .selectDistinct({ participantId: submissions.participantId })
          .from(submissions)
          .where(
            and(
              eq(submissions.marathonId, invitation.marathonId),
              eq(submissions.topicId, topicId),
            ),
          ),
      )) as Array<{ participantId: number }>
    } else if (invitation.inviteType === "class") {
      const competitionClassId = invitation.competitionClassId
      if (!competitionClassId) {
        return yield* Effect.fail(
          new DbError({
            message: "Class not found",
          }),
        )
      }

      participantIds = (yield* use((db) =>
        db
          .select({ participantId: participants.id })
          .from(participants)
          .where(
            and(
              eq(participants.marathonId, invitation.marathonId),
              eq(participants.competitionClassId, competitionClassId),
              ...(invitation.deviceGroupId === null || invitation.deviceGroupId === undefined
                ? []
                : [eq(participants.deviceGroupId, invitation.deviceGroupId)]),
            ),
          ),
      )) as Array<{ participantId: number }>
    } else {
      return yield* Effect.fail(
        new DbError({
          message: "Invitation type not found",
        }),
      )
    }

    if (ratingFilter && ratingFilter.length > 0) {
      const allRatings = yield* use((db) =>
        db.query.juryRatings.findMany({
          where: (table, operators) => operators.eq(table.invitationId, invitation.id),
        }),
      )
      const ratingMap = new Map()
      allRatings.forEach((rating) => {
        ratingMap.set(rating.participantId, rating.rating)
      })
      participantIds = participantIds.filter((participant) => {
        const rating = ratingMap.get(participant.participantId) || 0
        return ratingFilter.includes(rating)
      })
    }
    return { value: participantIds.length }
  })
  const getJuryInvitationStatistics: JuryRepository["Service"]["getJuryInvitationStatistics"] =
    Effect.fn("JuryRepository.getJuryInvitationStatistics")(function* ({ invitationId }) {
      const invitation = yield* use((db) =>
        db.query.juryInvitations.findFirst({
          where: (table, operators) => operators.eq(table.id, invitationId),
        }),
      )
      if (!invitation) {
        return yield* Effect.fail(
          new DbError({
            message: "Invitation not found",
          }),
        )
      }
      const invitationExpiry = new Date(invitation.expiresAt)
      if (invitationExpiry < new Date()) {
        return yield* Effect.fail(
          new DbError({
            message: "Invitation expired",
          }),
        )
      }
      const submissionConditions = [
        eq(submissions.marathonId, invitation.marathonId),
        eq(submissions.status, "uploaded"),
      ]
      if (invitation.competitionClassId !== null && invitation.competitionClassId !== undefined) {
        submissionConditions.push(
          eq(participants.competitionClassId, invitation.competitionClassId),
        )
      }
      if (invitation.deviceGroupId !== null && invitation.deviceGroupId !== undefined) {
        submissionConditions.push(eq(participants.deviceGroupId, invitation.deviceGroupId))
      }
      if (invitation.topicId !== null && invitation.topicId !== undefined) {
        submissionConditions.push(eq(submissions.topicId, invitation.topicId))
      }
      const participantIds = yield* use((db) =>
        db
          .selectDistinct({ participantId: submissions.participantId })
          .from(submissions)
          .innerJoin(participants, eq(participants.id, submissions.participantId))
          .where(and(...submissionConditions)),
      )
      const totalParticipants = participantIds.length
      const ratings = yield* use((db) =>
        db.query.juryRatings.findMany({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.invitationId, invitation.id),
              operators.eq(table.marathonId, invitation.marathonId),
            ),
          with: {
            participant: {
              columns: {
                id: true,
                reference: true,
                firstname: true,
                lastname: true,
              },
            },
          },
          orderBy: (table, operators) => operators.desc(table.createdAt),
        }),
      )
      const ratedParticipants = ratings.length
      const progressPercentage =
        totalParticipants > 0 ? (ratedParticipants / totalParticipants) * 100 : 0
      const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: ratings.filter((r) => r.rating === rating).length,
      }))
      const averageRating =
        ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0
      return {
        totalParticipants,
        ratedParticipants,
        progressPercentage,
        averageRating,
        ratingDistribution,
        recentRatings: ratings.slice(0, 5),
      }
    })
  return JuryRepository.of({
    getJuryInvitationsByMarathonId,
    getJuryInvitationById,
    getJuryInvitationsByDomain,
    createJuryInvitation,
    updateJuryInvitation,
    deleteJuryInvitation,
    getJuryDataByTokenPayload,
    getJurySubmissionsFromToken,
    getJurySubmissionsWithoutFilters,
    getJurySubmissionsWithRatingFilters,
    getJuryInvitationStatistics,
    getJuryParticipantCount,
    getJuryRating,
    getJuryRatingsByInvitation,
    getJuryRatingsWithRankingsByInvitation,
    getJuryAssignedFinalRankings,
    participantMatchesInvitationScope,
    createJuryRating,
    updateJuryRating,
    getJuryFinalRankingByParticipant,
    getJuryFinalRankingByRank,
    createJuryFinalRanking,
    updateJuryFinalRanking,
    deleteJuryFinalRankingByParticipant,
    deleteJuryRating,
  })
})

export const JuryRepositoryLayerNoDeps = Layer.effect(JuryRepository, makeJuryRepository)

export const JuryRepositoryLayer = JuryRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
