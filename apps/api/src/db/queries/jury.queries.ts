import { eq, and, desc, lt } from "drizzle-orm"
import type { Database } from "@vimmer/api/db"
import {
  submissions,
  participants,
  marathons,
  juryInvitations,
  juryRatings,
} from "@vimmer/api/db/schema"
import type { NewJuryInvitation, Participant, Submission, Topic } from "@vimmer/api/db/types"
import { TRPCError } from "@trpc/server"
import { jwtVerify } from "jose"
import { z } from "zod"

// export async function getJurySubmissionsQuery(
//   db: Database,
//   filters: {
//     domain: string
//     competitionClassId?: number | null
//     deviceGroupId?: number | null
//     topicId?: number | null
//   }
// ) {
//   const marathon = await db
//     .select({ id: marathons.id })
//     .from(marathons)
//     .where(eq(marathons.domain, filters.domain))
//     .limit(1)

//   if (!marathon.length) {
//     return []
//   }

//   const marathonId = marathon[0]!.id

//   const conditions = [
//     eq(submissions.marathonId, marathonId),
//     eq(submissions.status, "uploaded"),
//   ]

//   if (
//     filters.competitionClassId !== null &&
//     filters.competitionClassId !== undefined
//   ) {
//     conditions.push(
//       eq(participants.competitionClassId, filters.competitionClassId)
//     )
//   }

//   if (filters.deviceGroupId !== null && filters.deviceGroupId !== undefined) {
//     conditions.push(eq(participants.deviceGroupId, filters.deviceGroupId))
//   }

//   if (filters.topicId !== null && filters.topicId !== undefined) {
//     conditions.push(eq(submissions.topicId, filters.topicId))
//   }

//   const result = await db.query.submissions.findMany({
//     where: and(...conditions),
//     with: {
//       participant: {
//         with: {
//           competitionClass: true,
//           deviceGroup: true,
//         },
//       },
//       topic: true,
//     },
//   })

//   return result
// }

export async function getJuryInvitationsByMarathonIdQuery(db: Database, { id }: { id: number }) {
  const result = await db.query.juryInvitations.findMany({
    where: eq(juryInvitations.marathonId, id),
    orderBy: [desc(juryInvitations.createdAt)],
  })
  return result
}

export async function getJuryInvitationByIdQuery(db: Database, { id }: { id: number }) {
  const result = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, id),
  })
  return result ?? null
}

export async function getJuryInvitationsByDomainQuery(
  db: Database,
  { domain }: { domain: string }
) {
  const marathon = await db
    .select({ id: marathons.id })
    .from(marathons)
    .where(eq(marathons.domain, domain))
    .limit(1)

  if (!marathon.length) {
    return []
  }

  const marathonId = marathon[0]!.id

  const result = await db.query.juryInvitations.findMany({
    where: eq(juryInvitations.marathonId, marathonId),
    orderBy: [desc(juryInvitations.createdAt)],
    with: {
      competitionClass: true,
      deviceGroup: true,
      topic: true,
    },
  })

  return result
}

export async function createJuryInvitationMutation(
  db: Database,
  { data }: { data: NewJuryInvitation }
) {
  const result = await db.insert(juryInvitations).values(data).returning({ id: juryInvitations.id })

  if (!result[0]?.id) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create jury invitation",
    })
  }

  return result[0].id
}

export async function updateJuryInvitationMutation(
  db: Database,
  { id, data }: { id: number; data: Partial<NewJuryInvitation> }
) {
  const result = await db
    .update(juryInvitations)
    .set(data)
    .where(eq(juryInvitations.id, id))
    .returning({ id: juryInvitations.id })
  return result[0]?.id ?? null
}

export async function deleteJuryInvitationMutation(db: Database, { id }: { id: number }) {
  const result = await db
    .delete(juryInvitations)
    .where(eq(juryInvitations.id, id))
    .returning({ id: juryInvitations.id })
  return result[0]?.id ?? null
}

const TokenPayloadSchema = z.object({
  domain: z.string(),
  invitationId: z.number(),
  iat: z.number(),
  exp: z.number(),
})

async function verifyJuryToken(token: string) {
  try {
    const secret = process.env.JURY_JWT_SECRET
    if (!secret) {
      throw new Error("JWT SECRET is not set")
    }
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))

    const parsed = TokenPayloadSchema.safeParse(payload)
    if (parsed.success) {
      return parsed.data
    }
    return null
  } catch {
    return null
  }
}

export async function verifyJuryTokenAndGetDataQuery(db: Database, { token }: { token: string }) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
    with: {
      competitionClass: true,
      deviceGroup: true,
      topic: true,
      marathon: true,
    },
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  const marathon = await db.query.marathons.findFirst({
    where: eq(marathons.domain, tokenPayload.domain),
  })

  if (!marathon || invitation.marathonId !== marathon.id) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Marathon not found",
    })
  }

  const invitationExpiry = new Date(invitation.expiresAt)
  if (invitationExpiry < new Date()) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invitation expired",
    })
  }

  return invitation
}

// export async function getJuryParticipantsQuery(
//   db: Database,
//   { token }: { token: string }
// ) {
//   const tokenPayload = await verifyJuryToken(token)

//   if (!tokenPayload) {
//     throw new TRPCError({
//       code: "UNAUTHORIZED",
//       message: "Invalid token",
//     })
//   }

//   const now = Math.floor(Date.now() / 1000)
//   if (tokenPayload.exp < now) {
//     throw new TRPCError({
//       code: "UNAUTHORIZED",
//       message: "Token expired",
//     })
//   }

//   const invitation = await db.query.juryInvitations.findFirst({
//     where: eq(juryInvitations.id, tokenPayload.invitationId),
//     with: {
//       competitionClass: true,
//       deviceGroup: true,
//       topic: true,
//     },
//   })

//   if (!invitation) {
//     throw new TRPCError({
//       code: "NOT_FOUND",
//       message: "Invitation not found",
//     })
//   }

//   const marathon = await db.query.marathons.findFirst({
//     where: eq(marathons.domain, tokenPayload.domain),
//   })

//   if (!marathon || invitation.marathonId !== marathon.id) {
//     throw new TRPCError({
//       code: "NOT_FOUND",
//       message: "Marathon not found",
//     })
//   }

//   const invitationExpiry = new Date(invitation.expiresAt)
//   if (invitationExpiry < new Date()) {
//     throw new TRPCError({
//       code: "UNAUTHORIZED",
//       message: "Invitation expired",
//     })
//   }

//   const marathonId = marathon.id

//   const conditions = [
//     eq(submissions.marathonId, marathonId),
//     eq(submissions.status, "uploaded"),
//   ]

//   if (
//     invitation.competitionClassId !== null &&
//     invitation.competitionClassId !== undefined
//   ) {
//     conditions.push(
//       eq(participants.competitionClassId, invitation.competitionClassId)
//     )
//   }

//   if (
//     invitation.deviceGroupId !== null &&
//     invitation.deviceGroupId !== undefined
//   ) {
//     conditions.push(eq(participants.deviceGroupId, invitation.deviceGroupId))
//   }

//   if (invitation.topicId !== null && invitation.topicId !== undefined) {
//     conditions.push(eq(submissions.topicId, invitation.topicId))
//   }

//   const result = await db.query.submissions.findMany({
//     where: and(...conditions),
//     with: {
//       participant: {
//         with: {
//           competitionClass: true,
//           deviceGroup: true,
//         },
//       },
//       topic: true,
//     },
//     orderBy: [desc(submissions.id)],
//   })

//   // Group submissions by participant and count them
//   const participantMap = new Map<
//     number,
//     {
//       id: number
//       reference: string
//       firstname: string
//       lastname: string
//       competitionClass: CompetitionClass | null
//       deviceGroup: DeviceGroup | null
//       submissionCount: number
//       submissions: Submission[]
//     }
//   >()

//   result.forEach((submission) => {
//     if (!submission.previewKey || !submission.participant) return

//     const participantId = submission.participant.id
//     if (!participantMap.has(participantId)) {
//       participantMap.set(participantId, {
//         id: participantId,
//         reference: submission.participant.reference,
//         firstname: submission.participant.firstname,
//         lastname: submission.participant.lastname,
//         competitionClass: submission.participant.competitionClass,
//         deviceGroup: submission.participant.deviceGroup,
//         submissionCount: 0,
//         submissions: [],
//       })
//     }

//     const participant = participantMap.get(participantId)
//     if (!participant) {
//       throw new Error("Participant not found")
//     }
//     participant.submissionCount++
//     participant.submissions.push(submission)
//   })

//   const ratings = await db.query.juryRatings.findMany({
//     where: and(
//       eq(juryRatings.invitationId, invitation.id),
//       eq(juryRatings.marathonId, invitation.marathonId)
//     ),
//   })

//   return {
//     participants: Array.from(participantMap.values()),
//     invitation,
//     ratings,
//   }
// }

export async function getJuryParticipantSubmissionsQuery(
  db: Database,
  { token, participantId }: { token: string; participantId: number }
) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
    with: {
      competitionClass: true,
      deviceGroup: true,
      topic: true,
    },
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  const marathon = await db.query.marathons.findFirst({
    where: eq(marathons.domain, tokenPayload.domain),
  })

  if (!marathon || invitation.marathonId !== marathon.id) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Marathon not found",
    })
  }

  const invitationExpiry = new Date(invitation.expiresAt)
  if (invitationExpiry < new Date()) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invitation expired",
    })
  }

  const marathonId = marathon.id

  const conditions = [
    eq(submissions.marathonId, marathonId),
    eq(submissions.status, "uploaded"),
    eq(submissions.participantId, participantId),
  ]

  if (invitation.competitionClassId !== null && invitation.competitionClassId !== undefined) {
    conditions.push(eq(participants.competitionClassId, invitation.competitionClassId))
  }

  if (invitation.deviceGroupId !== null && invitation.deviceGroupId !== undefined) {
    conditions.push(eq(participants.deviceGroupId, invitation.deviceGroupId))
  }

  if (invitation.topicId !== null && invitation.topicId !== undefined) {
    conditions.push(eq(submissions.topicId, invitation.topicId))
  }

  const result = await db.query.submissions.findMany({
    where: and(...conditions),
    with: {
      participant: {
        with: {
          competitionClass: true,
          deviceGroup: true,
        },
      },
      topic: true,
    },
    orderBy: [desc(submissions.id)],
  })

  // Filter out submissions without preview images
  const validSubmissions = result.filter((submission) => submission.previewKey)

  return {
    submissions: validSubmissions,
    invitation,
  }
}

export async function createJuryRatingMutation(
  db: Database,
  {
    token,
    participantId,
    rating,
    notes,
  }: { token: string; participantId: number; rating: number; notes?: string }
) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  const result = await db
    .insert(juryRatings)
    .values({
      invitationId: tokenPayload.invitationId,
      participantId,
      rating,
      notes: notes || "",
      marathonId: invitation.marathonId,
    })
    .returning({ id: juryRatings.id })

  if (!result[0]?.id) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create jury rating",
    })
  }

  return result[0].id
}

export async function updateJuryRatingMutation(
  db: Database,
  {
    token,
    participantId,
    rating,
    notes,
    finalRanking,
  }: {
    token: string
    participantId: number
    rating: number
    notes?: string
    finalRanking?: number
  }
) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  const result = await db
    .update(juryRatings)
    .set({
      rating,
      notes: notes || "",
      finalRanking,
    })
    .where(
      and(
        eq(juryRatings.invitationId, tokenPayload.invitationId),
        eq(juryRatings.participantId, participantId)
      )
    )
    .returning({ id: juryRatings.id })

  return result[0]?.id ?? null
}

export async function getJuryRatingQuery(
  db: Database,
  { token, participantId }: { token: string; participantId: number }
) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  const result = await db.query.juryRatings.findFirst({
    where: and(
      eq(juryRatings.invitationId, tokenPayload.invitationId),
      eq(juryRatings.participantId, participantId)
    ),
  })

  return result ?? null
}

export async function deleteJuryRatingMutation(
  db: Database,
  { token, participantId }: { token: string; participantId: number }
) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  const result = await db
    .delete(juryRatings)
    .where(
      and(
        eq(juryRatings.invitationId, tokenPayload.invitationId),
        eq(juryRatings.participantId, participantId)
      )
    )
    .returning({ id: juryRatings.id })

  return result[0]?.id ?? null
}

async function getJurySubmissionsWithoutFiltersQuery(
  db: Database,
  invitation: any,
  cursor?: number
) {
  const limit = 50

  if (invitation.inviteType === "topic") {
    if (!invitation.topicId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Topic not found",
      })
    }

    let cursorSubmission: Submission | null = null

    if (cursor) {
      const [sub] = await db.select().from(submissions).where(eq(submissions.id, cursor)).limit(1)

      if (sub) {
        cursorSubmission = sub
      }
    }

    const topicSubmissions = await db.query.submissions.findMany({
      where: cursorSubmission
        ? and(
            eq(submissions.marathonId, invitation.marathonId),
            eq(submissions.topicId, invitation.topicId),
            lt(submissions.createdAt, cursorSubmission.createdAt)
          )
        : and(
            eq(submissions.marathonId, invitation.marathonId),
            eq(submissions.topicId, invitation.topicId)
          ),
      with: {
        topic: true,
        participant: {
          columns: {
            id: true,
            createdAt: true,
            reference: true,
            status: true,
            contactSheetKey: true,
          },
          with: {
            competitionClass: true,
            deviceGroup: true,
          },
        },
      },
      limit: limit + 1,
      orderBy: [desc(submissions.createdAt)],
    })

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
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Class not found",
      })
    }

    let cursorParticipant: Participant | null = null

    if (cursor) {
      const [participant] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, cursor))
        .limit(1)

      if (participant) {
        cursorParticipant = participant
      }
    }

    const participantsInCompetitionClass = await db.query.participants.findMany({
      columns: {
        id: true,
        createdAt: true,
        reference: true,
        status: true,
        contactSheetKey: true,
      },
      where: cursorParticipant
        ? and(
            eq(participants.marathonId, invitation.marathonId),
            eq(participants.competitionClassId, invitation.competitionClassId),
            lt(participants.createdAt, cursorParticipant.createdAt)
          )
        : and(
            eq(participants.marathonId, invitation.marathonId),
            eq(participants.competitionClassId, invitation.competitionClassId)
          ),
      with: {
        competitionClass: true,
        deviceGroup: true,
      },
      limit: limit + 1,
      orderBy: [desc(participants.createdAt)],
    })

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
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation type not found",
    })
  }
}

async function getJurySubmissionsWithRatingFiltersQuery(
  db: Database,
  invitation: any,
  ratingFilter: number[],
  cursor?: number
) {
  const limit = 50

  // Get all ratings for this invitation to create filter map
  const allRatings = await db.query.juryRatings.findMany({
    where: eq(juryRatings.invitationId, invitation.id),
  })

  const ratingMap = new Map<number, number>()
  allRatings.forEach((rating) => {
    ratingMap.set(rating.participantId, rating.rating)
  })

  // Get participant IDs that match the rating filter
  const filteredParticipantIds = Array.from(ratingMap.entries())
    .filter(([_, rating]) => ratingFilter.includes(rating))
    .map(([participantId]) => participantId)

  // Also include participants with no rating (rating 0) if 0 is in the filter
  if (ratingFilter.includes(0)) {
    if (invitation.inviteType === "topic") {
      const allTopicParticipants = await db
        .selectDistinct({ participantId: submissions.participantId })
        .from(submissions)
        .where(
          and(
            eq(submissions.marathonId, invitation.marathonId),
            eq(submissions.topicId, invitation.topicId)
          )
        )

      allTopicParticipants.forEach((p) => {
        if (!ratingMap.has(p.participantId)) {
          filteredParticipantIds.push(p.participantId)
        }
      })
    } else if (invitation.inviteType === "class") {
      const allClassParticipants = await db
        .select({ id: participants.id })
        .from(participants)
        .where(
          and(
            eq(participants.marathonId, invitation.marathonId),
            eq(participants.competitionClassId, invitation.competitionClassId)
          )
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

  // For rating-filtered results, we need to implement offset-based pagination
  // since cursor-based pagination becomes complex with pre-filtered participant IDs
  const offset = cursor || 0

  if (invitation.inviteType === "topic") {
    const topicSubmissions = await db.query.submissions.findMany({
      where: and(
        eq(submissions.marathonId, invitation.marathonId),
        eq(submissions.topicId, invitation.topicId)
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
      orderBy: [desc(submissions.createdAt)],
    })

    // Filter submissions by participant IDs that match rating criteria
    const filteredSubmissions = topicSubmissions.filter(
      (submission) =>
        submission.participant && filteredParticipantIds.includes(submission.participant.id)
    )

    // Apply offset pagination
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
    const participantsInCompetitionClass = await db.query.participants.findMany({
      columns: {
        id: true,
        createdAt: true,
        reference: true,
        status: true,
        contactSheetKey: true,
      },
      where: and(
        eq(participants.marathonId, invitation.marathonId),
        eq(participants.competitionClassId, invitation.competitionClassId)
      ),
      with: {
        competitionClass: true,
        deviceGroup: true,
      },
      orderBy: [desc(participants.createdAt)],
    })

    // Filter participants by IDs that match rating criteria
    const filteredParticipants = participantsInCompetitionClass.filter((participant) =>
      filteredParticipantIds.includes(participant.id)
    )

    // Apply offset pagination
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
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation type not found",
    })
  }
}

export async function getJurySubmissionsFromTokenQuery(
  db: Database,
  { token, cursor, ratingFilter }: { token: string; cursor?: number; ratingFilter?: number[] }
) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  // Delegate to appropriate function based on whether rating filters are applied
  if (ratingFilter && ratingFilter.length > 0) {
    return getJurySubmissionsWithRatingFiltersQuery(db, invitation, ratingFilter, cursor)
  } else {
    return getJurySubmissionsWithoutFiltersQuery(db, invitation, cursor)
  }
}

export async function getJuryRatingsByInvitationQuery(db: Database, { token }: { token: string }) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  const ratings = await db.query.juryRatings.findMany({
    where: and(
      eq(juryRatings.invitationId, invitation.id),
      eq(juryRatings.marathonId, invitation.marathonId)
    ),
    columns: {
      participantId: true,
      rating: true,
      notes: true,
    },
  })

  return { ratings }
}

export async function getJuryParticipantCountQuery(
  db: Database,
  { token, ratingFilter }: { token: string; ratingFilter?: number[] }
) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  // Get all unique participants from submissions
  const conditions = [eq(submissions.marathonId, invitation.marathonId)]
  if (invitation.topicId) {
    conditions.push(eq(submissions.topicId, invitation.topicId))
  }
  let participantIds = await db
    .selectDistinct({ participantId: submissions.participantId })
    .from(submissions)
    .where(
      and(
        eq(submissions.marathonId, invitation.marathonId),
        invitation.topicId ? eq(submissions.topicId, invitation.topicId) : undefined,
        ...conditions
      )
    )

  if (ratingFilter && ratingFilter.length > 0) {
    // Get all ratings for this invitation
    const allRatings = await db.query.juryRatings.findMany({
      where: eq(juryRatings.invitationId, invitation.id),
    })

    const ratingMap = new Map()
    allRatings.forEach((rating) => {
      ratingMap.set(rating.participantId, rating.rating)
    })

    // Filter participants based on ratings
    participantIds = participantIds.filter((participant) => {
      const rating = ratingMap.get(participant.participantId) || 0
      return ratingFilter.includes(rating)
    })
  }

  return { value: participantIds.length }
}

export async function getJuryInvitationStatisticsQuery(db: Database, { token }: { token: string }) {
  const tokenPayload = await verifyJuryToken(token)

  if (!tokenPayload) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid token",
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp < now) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token expired",
    })
  }

  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(juryInvitations.id, tokenPayload.invitationId),
  })

  if (!invitation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
  }

  const marathon = await db.query.marathons.findFirst({
    where: eq(marathons.domain, tokenPayload.domain),
  })

  if (!marathon || invitation.marathonId !== marathon.id) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Marathon not found",
    })
  }

  const invitationExpiry = new Date(invitation.expiresAt)
  if (invitationExpiry < new Date()) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invitation expired",
    })
  }

  // Get participants count based on invitation filters
  const submissionConditions = [
    eq(submissions.marathonId, marathon.id),
    eq(submissions.status, "uploaded"),
  ]

  if (invitation.competitionClassId !== null && invitation.competitionClassId !== undefined) {
    submissionConditions.push(eq(participants.competitionClassId, invitation.competitionClassId))
  }

  if (invitation.deviceGroupId !== null && invitation.deviceGroupId !== undefined) {
    submissionConditions.push(eq(participants.deviceGroupId, invitation.deviceGroupId))
  }

  if (invitation.topicId !== null && invitation.topicId !== undefined) {
    submissionConditions.push(eq(submissions.topicId, invitation.topicId))
  }

  // Get unique participants
  const participantIds = await db
    .selectDistinct({ participantId: submissions.participantId })
    .from(submissions)
    .innerJoin(participants, eq(participants.id, submissions.participantId))
    .where(and(...submissionConditions))

  const totalParticipants = participantIds.length

  // Get ratings for this invitation
  const ratings = await db.query.juryRatings.findMany({
    where: and(
      eq(juryRatings.invitationId, invitation.id),
      eq(juryRatings.marathonId, invitation.marathonId)
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
    orderBy: [desc(juryRatings.createdAt)],
  })

  const ratedParticipants = ratings.length
  const progressPercentage =
    totalParticipants > 0 ? (ratedParticipants / totalParticipants) * 100 : 0

  // Calculate rating distribution
  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratings.filter((r) => r.rating === rating).length,
  }))

  // Calculate average rating
  const averageRating =
    ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0

  return {
    totalParticipants,
    ratedParticipants,
    progressPercentage,
    averageRating,
    ratingDistribution,
    recentRatings: ratings.slice(0, 5), // Latest 5 ratings
  }
}
