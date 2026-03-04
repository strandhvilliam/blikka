import { Effect, Layer, Option, ServiceMap } from "effect"
import { DrizzleClient } from "../drizzle-client"
import {
  votingSession,
  marathons,
  participants,
  submissions,
  topics,
} from "../schema"
import {
  eq,
  inArray,
  sql,
  count,
  and,
  desc,
  asc,
  isNull,
} from "drizzle-orm"
import type { NewVotingSession, VotingSession } from "../types"

export class VotingQueries extends ServiceMap.Service<VotingQueries>()(
  "@blikka/db/voting-queries",
  {
    make: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getVotingSessionByToken = Effect.fn(
        "VotingQueries.getVotingSessionByToken",
      )(function* ({ token }: { token: string }) {
        const result = yield* db.query.votingSession.findFirst({
          where: { token },
          with: {
            marathon: true,
            topic: true,
          },
        })
        return Option.fromNullishOr(result)
      })

      const getPublicMarathonByDomain = Effect.fn(
        "VotingQueries.getPublicMarathonByDomain",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* db.query.marathons.findFirst({
          where: { domain },
          columns: {
            id: true,
            name: true,
            domain: true,
            logoUrl: true,
            description: true,
            startDate: true,
            endDate: true,
          },
        })
        return Option.fromNullishOr(result)
      })

      const getParticipantsWithSubmissionsByTopicId = Effect.fn(
        "VotingQueries.getParticipantsWithSubmissionsByMarathonId",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const result = yield* db.query.participants.findMany({
          where: { marathonId },
          with: {
            submissions: true,
          },
        })

        return result
          .filter((p) => p.submissions.some((s) => s.topicId === topicId))
          .map((p) => ({
            ...p,
            submissions: p.submissions.filter((s) => s.topicId === topicId),
          }))
      })

      const getParticipantsWithSubmissionsButNoVotingSession = Effect.fn(
        "VotingQueries.getParticipantsWithSubmissionsButNoVotingSession",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const result = yield* db
          .selectDistinct({
            id: participants.id,
            firstname: participants.firstname,
            lastname: participants.lastname,
            reference: participants.reference,
            email: participants.email,
          })
          .from(participants)
          .innerJoin(
            submissions,
            and(
              eq(participants.id, submissions.participantId),
              eq(submissions.marathonId, marathonId),
              eq(submissions.topicId, topicId),
            ),
          )
          .leftJoin(
            votingSession,
            and(
              eq(votingSession.connectedParticipantId, participants.id),
              eq(votingSession.topicId, topicId),
            ),
          )
          .where(isNull(votingSession.id))

        return result
      })

      const createVotingSessions = Effect.fn(
        "VotingQueries.createVotingSessions",
      )(function* ({ sessions }: { sessions: NewVotingSession[] }) {
        if (sessions.length === 0) {
          return []
        }

        const result = yield* db
          .insert(votingSession)
          .values(sessions)
          .returning()
        return result
      })

      const updateMultipleLastNotificationSentAt = Effect.fn(
        "VotingQueries.updateLastNotificationSentAt",
      )(function* ({
        ids,
        notificationLastSentAt,
      }: {
        ids: number[]
        notificationLastSentAt: string | null
      }) {
        yield* db
          .update(votingSession)
          .set({ notificationLastSentAt })
          .where(inArray(votingSession.id, ids))
      })

      const countVotingSessionsForTopic = Effect.fn(
        "VotingQueries.countVotingSessionsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const result = yield* db
          .select({ value: count() })
          .from(votingSession)
          .where(
            and(
              eq(votingSession.marathonId, marathonId),
              eq(votingSession.topicId, topicId),
            ),
          )

        return result[0]?.value ?? 0
      })

      const getVotingSessionsForTopic = Effect.fn(
        "VotingQueries.getVotingSessionsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        return yield* db.query.votingSession.findMany({
          where: { marathonId, topicId },
          with: {
            participant: {
              columns: {
                id: true,
                firstname: true,
                lastname: true,
                reference: true,
              },
            },
            submissions: {
              columns: {
                id: true,
                participantId: true,
                topicId: true,
              },
              with: {
                participant: {
                  columns: {
                    id: true,
                    firstname: true,
                    lastname: true,
                    reference: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      })

      const getSubmissionVoteLeaderboardForTopic = Effect.fn(
        "VotingQueries.getSubmissionVoteLeaderboardForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        return yield* db
          .select({
            submissionId: submissions.id,
            submissionCreatedAt: submissions.createdAt,
            submissionKey: submissions.key,
            submissionThumbnailKey: submissions.thumbnailKey,
            participantId: participants.id,
            participantFirstName: participants.firstname,
            participantLastName: participants.lastname,
            participantReference: participants.reference,
            voteCount: sql<number>`count(${votingSession.id})`.as("vote_count"),
          })
          .from(submissions)
          .innerJoin(
            participants,
            eq(participants.id, submissions.participantId),
          )
          .leftJoin(
            votingSession,
            and(
              eq(votingSession.voteSubmissionId, submissions.id),
              eq(votingSession.marathonId, marathonId),
              eq(votingSession.topicId, topicId),
            ),
          )
          .where(
            and(
              eq(submissions.marathonId, marathonId),
              eq(submissions.topicId, topicId),
            ),
          )
          .groupBy(
            submissions.id,
            submissions.createdAt,
            submissions.key,
            submissions.thumbnailKey,
            participants.id,
            participants.firstname,
            participants.lastname,
            participants.reference,
          )
          .orderBy(
            desc(sql<number>`count(${votingSession.id})`),
            asc(submissions.createdAt),
            asc(submissions.id),
          )
      })

      const getVotingSessionStatsForTopic = Effect.fn(
        "VotingQueries.getVotingSessionStatsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const result = yield* db
          .select({
            total: sql<number>`count(*)`.as("total"),
            completed: sql<number>`count(${votingSession.votedAt})`.as(
              "completed",
            ),
            participantSessions: sql<number>`count(${votingSession.connectedParticipantId})`.as(
              "participant_sessions",
            ),
            manualSessions: sql<number>`count(*) - count(${votingSession.connectedParticipantId})`.as(
              "manual_sessions",
            ),
          })
          .from(votingSession)
          .where(
            and(
              eq(votingSession.marathonId, marathonId),
              eq(votingSession.topicId, topicId),
            ),
          )

        return (
          result[0] ?? {
            total: 0,
            completed: 0,
            participantSessions: 0,
            manualSessions: 0,
          }
        )
      })

      const getVotingWindowForTopic = Effect.fn(
        "VotingQueries.getVotingWindowForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const result = yield* db.query.topics.findFirst({
          where: { marathonId, id: topicId },
          columns: {
            votingStartsAt: true,
            votingEndsAt: true,
          },
        })

        if (!result) {
          return undefined
        }

        return {
          startsAt: result.votingStartsAt,
          endsAt: result.votingEndsAt,
        }
      })

      const upsertTopicVotingWindow = Effect.fn(
        "VotingQueries.upsertTopicVotingWindow",
      )(function* ({
        marathonId,
        topicId,
        startsAt,
        endsAt,
      }: {
        marathonId: number
        topicId: number
        startsAt: string
        endsAt: string
      }) {
        const result = yield* db
          .update(topics)
          .set({
            votingStartsAt: startsAt,
            votingEndsAt: endsAt,
            updatedAt: new Date().toISOString(),
          })
          .where(and(eq(topics.marathonId, marathonId), eq(topics.id, topicId)))
          .returning({
            startsAt: topics.votingStartsAt,
            endsAt: topics.votingEndsAt,
          })

        return result[0]
      })

      const closeTopicVotingWindow = Effect.fn(
        "VotingQueries.closeTopicVotingWindow",
      )(function* ({
        marathonId,
        topicId,
        nowIso,
      }: {
        marathonId: number
        topicId: number
        nowIso: string
      }) {
        const result = yield* db
          .update(topics)
          .set({
            votingStartsAt: sql`case
              when ${topics.votingStartsAt} is null
                then ${nowIso}::timestamptz - interval '1 second'
              when ${topics.votingStartsAt} >= ${nowIso}::timestamptz
                then ${nowIso}::timestamptz - interval '1 second'
              else ${topics.votingStartsAt}
            end`,
            votingEndsAt: sql`${nowIso}::timestamptz`,
            updatedAt: nowIso,
          })
          .where(
            and(eq(topics.marathonId, marathonId), eq(topics.id, topicId)),
          )
          .returning({
            startsAt: topics.votingStartsAt,
            endsAt: topics.votingEndsAt,
          })

        return result[0]
      })

      const closeVotingWindowsForTopics = Effect.fn(
        "VotingQueries.closeVotingWindowsForTopics",
      )(function* ({
        marathonId,
        topicIds,
        nowIso,
      }: {
        marathonId: number
        topicIds: readonly number[]
        nowIso: string
      }) {
        if (topicIds.length === 0) {
          return []
        }

        return yield* db
          .update(topics)
          .set({
            votingStartsAt: sql`case
              when ${topics.votingStartsAt} is null
                then ${nowIso}::timestamptz - interval '1 second'
              when ${topics.votingStartsAt} >= ${nowIso}::timestamptz
                then ${nowIso}::timestamptz - interval '1 second'
              else ${topics.votingStartsAt}
            end`,
            votingEndsAt: sql`${nowIso}::timestamptz`,
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(topics.marathonId, marathonId),
              inArray(topics.id, [...topicIds]),
            ),
          )
          .returning({
            topicId: topics.id,
            startsAt: topics.votingStartsAt,
            endsAt: topics.votingEndsAt,
          })
      })

      const countSubmissionsForTopic = Effect.fn(
        "VotingQueries.countSubmissionsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const result = yield* db
          .select({ value: count() })
          .from(submissions)
          .where(
            and(
              eq(submissions.marathonId, marathonId),
              eq(submissions.topicId, topicId),
            ),
          )

        return result[0]?.value ?? 0
      })

      const countParticipantsWithSubmissionsForTopic = Effect.fn(
        "VotingQueries.countParticipantsWithSubmissionsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const result = yield* db
          .select({
            value: sql<number>`count(distinct ${submissions.participantId})`.as(
              "value",
            ),
          })
          .from(submissions)
          .where(
            and(
              eq(submissions.marathonId, marathonId),
              eq(submissions.topicId, topicId),
            ),
          )

        return result[0]?.value ?? 0
      })

      const getLeaderboardPageForTopic = Effect.fn(
        "VotingQueries.getLeaderboardPageForTopic",
      )(function* ({
        marathonId,
        topicId,
        page,
        limit,
      }: {
        marathonId: number
        topicId: number
        page: number
        limit: number
      }) {
        const offset = (page - 1) * limit

        const leaderboardBase = db
          .select({
            submissionId: sql<number>`${submissions.id}`.as("submission_id"),
            submissionCreatedAt: submissions.createdAt,
            submissionKey: submissions.key,
            submissionThumbnailKey: submissions.thumbnailKey,
            participantId: sql<number>`${participants.id}`.as("participant_id"),
            participantFirstName: participants.firstname,
            participantLastName: participants.lastname,
            participantReference: participants.reference,
            voteCount: sql<number>`count(${votingSession.id})`.as("vote_count"),
          })
          .from(submissions)
          .innerJoin(
            participants,
            eq(participants.id, submissions.participantId),
          )
          .leftJoin(
            votingSession,
            and(
              eq(votingSession.voteSubmissionId, submissions.id),
              eq(votingSession.marathonId, marathonId),
              eq(votingSession.topicId, topicId),
            ),
          )
          .where(
            and(
              eq(submissions.marathonId, marathonId),
              eq(submissions.topicId, topicId),
            ),
          )
          .groupBy(
            submissions.id,
            submissions.createdAt,
            submissions.key,
            submissions.thumbnailKey,
            participants.id,
            participants.firstname,
            participants.lastname,
            participants.reference,
          )
          .as("leaderboard_base")

        const rankedLeaderboard = db
          .select({
            submissionId: leaderboardBase.submissionId,
            submissionCreatedAt: leaderboardBase.submissionCreatedAt,
            submissionKey: leaderboardBase.submissionKey,
            submissionThumbnailKey: leaderboardBase.submissionThumbnailKey,
            participantId: leaderboardBase.participantId,
            participantFirstName: leaderboardBase.participantFirstName,
            participantLastName: leaderboardBase.participantLastName,
            participantReference: leaderboardBase.participantReference,
            voteCount: leaderboardBase.voteCount,
            rank: sql<number>`rank() over (
              order by ${leaderboardBase.voteCount} desc
            )`.as("rank"),
            tieSize: sql<number>`count(*) over (partition by ${leaderboardBase.voteCount})`.as(
              "tie_size",
            ),
          })
          .from(leaderboardBase)
          .as("ranked_leaderboard")

        return yield* db
          .select({
            submissionId: rankedLeaderboard.submissionId,
            submissionCreatedAt: rankedLeaderboard.submissionCreatedAt,
            submissionKey: rankedLeaderboard.submissionKey,
            submissionThumbnailKey: rankedLeaderboard.submissionThumbnailKey,
            participantId: rankedLeaderboard.participantId,
            participantFirstName: rankedLeaderboard.participantFirstName,
            participantLastName: rankedLeaderboard.participantLastName,
            participantReference: rankedLeaderboard.participantReference,
            voteCount: rankedLeaderboard.voteCount,
            rank: rankedLeaderboard.rank,
            tieSize: rankedLeaderboard.tieSize,
          })
          .from(rankedLeaderboard)
          .orderBy(
            desc(rankedLeaderboard.voteCount),
            asc(rankedLeaderboard.submissionCreatedAt),
            asc(rankedLeaderboard.submissionKey),
          )
          .limit(limit)
          .offset(offset)
      })

      const getTopRanksPreviewForTopic = Effect.fn(
        "VotingQueries.getTopRanksPreviewForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const leaderboardBase = db
          .select({
            submissionId: sql<number>`${submissions.id}`.as("submission_id"),
            submissionCreatedAt: submissions.createdAt,
            submissionKey: submissions.key,
            submissionThumbnailKey: submissions.thumbnailKey,
            participantId: sql<number>`${participants.id}`.as("participant_id"),
            participantFirstName: participants.firstname,
            participantLastName: participants.lastname,
            participantReference: participants.reference,
            voteCount: sql<number>`count(${votingSession.id})`.as("vote_count"),
          })
          .from(submissions)
          .innerJoin(
            participants,
            eq(participants.id, submissions.participantId),
          )
          .leftJoin(
            votingSession,
            and(
              eq(votingSession.voteSubmissionId, submissions.id),
              eq(votingSession.marathonId, marathonId),
              eq(votingSession.topicId, topicId),
            ),
          )
          .where(
            and(
              eq(submissions.marathonId, marathonId),
              eq(submissions.topicId, topicId),
            ),
          )
          .groupBy(
            submissions.id,
            submissions.createdAt,
            submissions.key,
            submissions.thumbnailKey,
            participants.id,
            participants.firstname,
            participants.lastname,
            participants.reference,
          )
          .as("leaderboard_base")

        const rankedLeaderboard = db
          .select({
            submissionId: leaderboardBase.submissionId,
            submissionCreatedAt: leaderboardBase.submissionCreatedAt,
            submissionKey: leaderboardBase.submissionKey,
            submissionThumbnailKey: leaderboardBase.submissionThumbnailKey,
            participantId: leaderboardBase.participantId,
            participantFirstName: leaderboardBase.participantFirstName,
            participantLastName: leaderboardBase.participantLastName,
            participantReference: leaderboardBase.participantReference,
            voteCount: leaderboardBase.voteCount,
            rank: sql<number>`rank() over (
              order by ${leaderboardBase.voteCount} desc
            )`.as("rank"),
            tieSize: sql<number>`count(*) over (partition by ${leaderboardBase.voteCount})`.as(
              "tie_size",
            ),
          })
          .from(leaderboardBase)
          .as("ranked_leaderboard")

        const rankedPreview = db
          .select({
            submissionId: rankedLeaderboard.submissionId,
            submissionCreatedAt: rankedLeaderboard.submissionCreatedAt,
            submissionKey: rankedLeaderboard.submissionKey,
            submissionThumbnailKey: rankedLeaderboard.submissionThumbnailKey,
            participantId: rankedLeaderboard.participantId,
            participantFirstName: rankedLeaderboard.participantFirstName,
            participantLastName: rankedLeaderboard.participantLastName,
            participantReference: rankedLeaderboard.participantReference,
            voteCount: rankedLeaderboard.voteCount,
            rank: rankedLeaderboard.rank,
            tieSize: rankedLeaderboard.tieSize,
            rankEntryOrder: sql<number>`row_number() over (
              partition by ${rankedLeaderboard.rank}
              order by ${rankedLeaderboard.submissionCreatedAt} asc, ${rankedLeaderboard.submissionKey} asc
            )`.as("rank_entry_order"),
          })
          .from(rankedLeaderboard)
          .as("ranked_preview")

        return yield* db
          .select({
            submissionId: rankedPreview.submissionId,
            submissionCreatedAt: rankedPreview.submissionCreatedAt,
            submissionKey: rankedPreview.submissionKey,
            submissionThumbnailKey: rankedPreview.submissionThumbnailKey,
            participantId: rankedPreview.participantId,
            participantFirstName: rankedPreview.participantFirstName,
            participantLastName: rankedPreview.participantLastName,
            participantReference: rankedPreview.participantReference,
            voteCount: rankedPreview.voteCount,
            rank: rankedPreview.rank,
            tieSize: rankedPreview.tieSize,
            rankEntryOrder: rankedPreview.rankEntryOrder,
          })
          .from(rankedPreview)
          .where(
            and(
              sql`${rankedPreview.rank} <= 3`,
              sql`${rankedPreview.rankEntryOrder} <= 3`,
            ),
          )
          .orderBy(asc(rankedPreview.rank), asc(rankedPreview.rankEntryOrder))
      })

      const getVotersPageForTopic = Effect.fn(
        "VotingQueries.getVotersPageForTopic",
      )(function* ({
        marathonId,
        topicId,
        page,
        limit,
      }: {
        marathonId: number
        topicId: number
        page: number
        limit: number
      }) {
        const offset = (page - 1) * limit
        return yield* db.query.votingSession.findMany({
          where: { marathonId, topicId },
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            token: true,
            phoneEncrypted: true,
            notificationLastSentAt: true,
            connectedParticipantId: true,
            votedAt: true,
            voteSubmissionId: true,
          },
          with: {
            submissions: {
              columns: {
                id: true,
                key: true,
                thumbnailKey: true,
                createdAt: true,
              },
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
            },
          },
          orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
          limit,
          offset,
        })
      })

      const getVotingSessionByIdForTopic = Effect.fn(
        "VotingQueries.getVotingSessionByIdForTopic",
      )(function* ({
        marathonId,
        topicId,
        sessionId,
      }: {
        marathonId: number
        topicId: number
        sessionId: number
      }) {
        const result = yield* db.query.votingSession.findFirst({
          where: { id: sessionId, marathonId, topicId },
          with: {
            marathon: true,
          },
        })

        return Option.fromNullishOr(result)
      })

      const getSubmissionVoteStats = Effect.fn(
        "VotingQueries.getSubmissionVoteStats",
      )(function* ({
        submissionId,
        domain,
      }: {
        submissionId: number
        domain: string
      }) {
        const marathonResult = yield* db.query.marathons.findFirst({
          where: { domain },
          columns: {
            id: true,
          },
        })

        if (!marathonResult) {
          return Option.none()
        }

        const marathonId = marathonResult.id

        const voteCountResult = yield* db
          .select({ count: count() })
          .from(votingSession)
          .where(eq(votingSession.voteSubmissionId, submissionId))

        const voteCount = voteCountResult[0]?.count ?? 0

        const allSubmissionsWithVotes = yield* db
          .select({
            submissionId: submissions.id,
            voteCount: sql<number>`count(${votingSession.id})`.as("vote_count"),
          })
          .from(submissions)
          .leftJoin(
            votingSession,
            eq(submissions.id, votingSession.voteSubmissionId),
          )
          .where(eq(submissions.marathonId, marathonId))
          .groupBy(submissions.id)

        const position =
          allSubmissionsWithVotes.filter((s) => s.voteCount > voteCount)
            .length + 1
        const totalSubmissions = allSubmissionsWithVotes.length

        return Option.some({
          voteCount,
          position,
          totalSubmissions,
        })
      })

      const getParticipantVoteInfo = Effect.fn(
        "VotingQueries.getParticipantVoteInfo",
      )(function* ({
        participantId,
        topicId,
      }: {
        participantId: number
        topicId: number
      }) {
        const votingSessionResult = yield* db.query.votingSession.findFirst({
          where: { connectedParticipantId: participantId, topicId },
          with: {
            submissions: {
              with: {
                topic: true,
              },
            },
          },
        })

        if (!votingSessionResult) {
          return Option.none()
        }

        return Option.some({
          hasVoted: votingSessionResult.votedAt !== null,
          votedAt: votingSessionResult.votedAt,
          votedSubmissionId: votingSessionResult.voteSubmissionId,
          votedTopicName: votingSessionResult.submissions?.topic?.name ?? null,
        })
      })

      const getVotingSessionByParticipantId = Effect.fn(
        "VotingQueries.getVotingSessionByParticipantId",
      )(function* ({ participantId }: { participantId: number }) {
        const result = yield* db.query.votingSession.findFirst({
          where: { connectedParticipantId: participantId },
          orderBy: { createdAt: "desc" },
        })

        return Option.fromNullishOr(result)
      })

      const getVotingSessionByParticipantAndTopicId = Effect.fn(
        "VotingQueries.getVotingSessionByParticipantAndTopicId",
      )(function* ({
        participantId,
        topicId,
      }: {
        participantId: number
        topicId: number
      }) {
        const result = yield* db.query.votingSession.findFirst({
          where: { connectedParticipantId: participantId, topicId },
          orderBy: { createdAt: "desc" },
        })

        return Option.fromNullishOr(result)
      })

      const upsertVotingSession = Effect.fn(
        "VotingQueries.upsertVotingSession",
      )(function* (sessionData: NewVotingSession) {
        const result = yield* db
          .insert(votingSession)
          .values(sessionData)
          .onConflictDoUpdate({
            target: [
              votingSession.connectedParticipantId,
              votingSession.topicId,
            ],
            set: {
              token: sessionData.token,
              firstName: sessionData.firstName,
              lastName: sessionData.lastName,
              email: sessionData.email,
              phoneHash: sessionData.phoneHash,
              phoneEncrypted: sessionData.phoneEncrypted,
              marathonId: sessionData.marathonId,
              notificationLastSentAt: sessionData.notificationLastSentAt,
              updatedAt: new Date().toISOString(),
            },
          })
          .returning()

        return result[0] as VotingSession
      })

      const getSubmissionsForVoting = Effect.fn(
        "VotingQueries.getSubmissionsForVoting",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number
        topicId: number
      }) {
        const result = yield* db.query.submissions.findMany({
          where: { marathonId, topicId },
          orderBy: { id: "asc" },
          with: {
            participant: {
              columns: {
                id: true,
                firstname: true,
                lastname: true,
              },
            },
            topic: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        })

        return result
      })

      const recordVote = Effect.fn("VotingQueries.recordVote")(function* ({
        token,
        submissionId,
      }: {
        token: string
        submissionId: number
      }) {
        const now = new Date().toISOString()
        const result = yield* db
          .update(votingSession)
          .set({
            voteSubmissionId: submissionId,
            votedAt: now,
            updatedAt: now,
          })
          .where(eq(votingSession.token, token))
          .returning()

        return result[0] as VotingSession | undefined
      })

      const clearVote = Effect.fn("VotingQueries.clearVote")(function* ({
        sessionId,
      }: {
        sessionId: number
      }) {
        const now = new Date().toISOString()
        const result = yield* db
          .update(votingSession)
          .set({
            voteSubmissionId: null,
            votedAt: null,
            updatedAt: now,
          })
          .where(eq(votingSession.id, sessionId))
          .returning()

        return result[0] as VotingSession | undefined
      })

      const deleteVotingSession = Effect.fn(
        "VotingQueries.deleteVotingSession",
      )(function* ({ sessionId }: { sessionId: number }) {
        const result = yield* db
          .delete(votingSession)
          .where(eq(votingSession.id, sessionId))
          .returning()

        return result[0] as VotingSession | undefined
      })

      return {
        getVotingSessionByToken,
        getPublicMarathonByDomain,
        getParticipantsWithSubmissionsByTopicId,
        getParticipantsWithSubmissionsButNoVotingSession,
        createVotingSessions,
        updateMultipleLastNotificationSentAt,
        countVotingSessionsForTopic,
        getVotingSessionsForTopic,
        getSubmissionVoteLeaderboardForTopic,
        getVotingSessionStatsForTopic,
        getVotingWindowForTopic,
        upsertTopicVotingWindow,
        closeTopicVotingWindow,
        closeVotingWindowsForTopics,
        countSubmissionsForTopic,
        countParticipantsWithSubmissionsForTopic,
        getLeaderboardPageForTopic,
        getTopRanksPreviewForTopic,
        getVotersPageForTopic,
        getVotingSessionByIdForTopic,
        getSubmissionVoteStats,
        getParticipantVoteInfo,
        getVotingSessionByParticipantId,
        getVotingSessionByParticipantAndTopicId,
        upsertVotingSession,
        getSubmissionsForVoting,
        recordVote,
        clearVote,
        deleteVotingSession,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer)
  )
}
