import { Effect, Layer, Option, Context } from "effect"
import { DrizzleClient, type DrizzleDatabase } from "../drizzle-client"
import {
  marathons,
  participants,
  submissions,
  topics,
  votingRound,
  votingRoundSubmission,
  votingRoundVote,
  votingSession,
} from "../schema"
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import type {
  Marathon,
  NewVotingRound,
  NewVotingRoundSubmission,
  NewVotingRoundVote,
  NewVotingSession,
  Participant,
  Submission,
  Topic,
  VotingRound,
  VotingRoundSubmission,
  VotingRoundVote,
  VotingSession,
} from "../types"
import { DbError } from "../utils"

interface ResolveRoundInput {
  marathonId: number
  topicId: number
  roundId?: number | null
}

interface ParticipantVoteInfo {
  hasVoted: boolean
  votedAt: string | null
  votedSubmissionId: number | null
  votedTopicName: string | null
  roundId: number | null
  roundNumber: number | null
  roundKind: string | null
}

interface SubmissionVoteStatsRow {
  voteCount: number
  position: number | null
  totalSubmissions: number
  roundId: number | null
  roundNumber: number | null
  roundKind: string | null
}

interface LeaderboardPageRow {
  submissionId: number
  submissionCreatedAt: string
  submissionKey: string
  submissionThumbnailKey: string | null
  participantId: number
  participantFirstName: string
  participantLastName: string
  participantReference: string
  voteCount: number
  rank: number
  tieSize: number
}

interface TopRanksPreviewRow extends LeaderboardPageRow {
  rankEntryOrder: number
}

interface ParticipantWithoutSessionRow extends Pick<
  Participant,
  "id" | "firstname" | "lastname" | "reference" | "email"
> {}

type VotingSessionWithMarathonAndTopic = VotingSession & { marathon: Marathon; topic: Topic }

interface VotingSessionWithMarathonName extends Pick<
  VotingSession,
  "id" | "token" | "phoneEncrypted" | "notificationLastSentAt"
> {
  marathon: Pick<Marathon, "domain" | "name">
}

interface VotingSessionWithMarathon extends VotingSession {
  marathon: Marathon
}

type VotingRoundSummary = Pick<
  VotingRound,
  "id" | "roundNumber" | "kind" | "sourceRoundId" | "startedAt" | "endsAt"
>

interface LeadingTieResult {
  roundId: number
  roundNumber: number
  roundKind: string
  voteCount: number
  tieSize: number
  submissionIds: number[]
}

interface SubmissionForVotingRow extends Pick<
  Submission,
  "id" | "participantId" | "key" | "thumbnailKey" | "previewKey" | "topicId"
> {
  participant: Pick<Participant, "id" | "firstname" | "lastname">
  topic: Pick<Topic, "id" | "name">
}

interface TopicWindowCloseRow {
  topicId: number
  startsAt: string
  endsAt: string | null
}

interface VotersPageRow {
  id: number
  firstName: string | null
  lastName: string | null
  email: string | null
  token: string
  phoneEncrypted: string | null
  notificationLastSentAt: string | null
  connectedParticipantId: number | null
  votedAt: string | null
  voteSubmissionId: number | null
  voteSubmissionKey: string | null
  voteSubmissionThumbnailKey: string | null
  voteSubmissionCreatedAt: string | null
  voteParticipantId: number | null
  voteParticipantReference: string | null
  voteParticipantFirstName: string | null
  voteParticipantLastName: string | null
}

export class VotingRepository extends Context.Service<
  VotingRepository,
  {
    /** Voting session with marathon and topic by token, or none if missing. */
    readonly getVotingSessionByToken: (params: {
      token: string
    }) => Effect.Effect<Option.Option<VotingSessionWithMarathonAndTopic>, DbError>
    /** Voting sessions by ids with marathon domain and name. */
    readonly getVotingSessionsByIdsWithMarathon: (params: {
      ids: number[]
    }) => Effect.Effect<VotingSessionWithMarathonName[], DbError>
    /** Participants with their submissions for a marathon topic. */
    readonly getParticipantsWithSubmissionsByTopicId: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<Array<Participant & { submissions: Submission[] }>, DbError>
    /** Participants who submitted for the topic but have no voting session. */
    readonly getParticipantsWithSubmissionsButNoVotingSession: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<ParticipantWithoutSessionRow[], DbError>
    /** Insert multiple voting session rows. */
    readonly createVotingSessions: (params: {
      sessions: NewVotingSession[]
    }) => Effect.Effect<VotingSession[], DbError>
    /** Patch last notification sent timestamp for the given session ids. */
    readonly updateMultipleLastNotificationSentAt: (params: {
      ids: number[]
      notificationLastSentAt: string | null
    }) => Effect.Effect<void, DbError>
    /** Count voting sessions for a marathon topic. */
    readonly countVotingSessionsForTopic: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<number, DbError>
    /** Insert a voting round row. */
    readonly createVotingRound: (
      roundData: NewVotingRound,
    ) => Effect.Effect<VotingRound | undefined, DbError>
    /** Link submission ids to a voting round. */
    readonly createVotingRoundSubmissions: (params: {
      roundId: number
      submissionIds: readonly number[]
    }) => Effect.Effect<VotingRoundSubmission[], DbError>
    /** Insert voting round vote rows. */
    readonly createVotingRoundVotes: (params: {
      votes: NewVotingRoundVote[]
    }) => Effect.Effect<VotingRoundVote[], DbError>
    /** Voting round scoped to marathon and topic, or none if missing. */
    readonly getVotingRoundById: (params: {
      marathonId: number
      topicId: number
      roundId: number
    }) => Effect.Effect<Option.Option<VotingRound>, DbError>
    /** Latest voting round for a topic, or none if missing. */
    readonly getLatestVotingRoundForTopic: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<Option.Option<VotingRound>, DbError>
    /** Active voting round for a topic, or none if none is open. */
    readonly getActiveVotingRoundForTopic: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<Option.Option<VotingRound>, DbError>
    /** Aggregate voting session counts for admin stats. */
    readonly getVotingSessionStatsForTopic: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<
      {
        total: number
        completed: number
        participantSessions: number
        manualSessions: number
      },
      DbError
    >
    /** Topic voting window bounds, or undefined if not configured. */
    readonly getVotingWindowForTopic: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<
      | {
          startsAt: string
          endsAt: string | null
        }
      | undefined,
      DbError
    >
    /** Patch start/end timestamps on a voting round. */
    readonly updateVotingRoundWindow: (params: {
      roundId: number
      startedAt?: string
      endsAt: string | null
      updatedAt: string
    }) => Effect.Effect<VotingRound | undefined, DbError>
    /** Close the topic voting window at the given timestamp. */
    readonly closeTopicVotingWindow: (params: {
      marathonId: number
      topicId: number
      nowIso: string
    }) => Effect.Effect<
      | {
          startsAt: string
          endsAt: string | null
        }
      | undefined,
      DbError
    >
    /** Reopen the topic voting window after it was closed. */
    readonly reopenTopicVotingWindow: (params: {
      marathonId: number
      topicId: number
      nowIso: string
    }) => Effect.Effect<
      | {
          startsAt: string
          endsAt: string | null
        }
      | undefined,
      DbError
    >
    /** Close voting windows for multiple topics in one operation. */
    readonly closeVotingWindowsForTopics: (params: {
      marathonId: number
      topicIds: readonly number[]
      nowIso: string
    }) => Effect.Effect<TopicWindowCloseRow[], DbError>
    /** Count submissions for a marathon topic. */
    readonly countSubmissionsForTopic: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<number, DbError>
    /** Count participants with at least one submission for the topic. */
    readonly countParticipantsWithSubmissionsForTopic: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<number, DbError>
    /** Count submissions in the resolved voting round for the topic. */
    readonly countVotingRoundSubmissionsForTopic: (
      params: ResolveRoundInput,
    ) => Effect.Effect<number, DbError>
    /** Summaries of all voting rounds for a topic. */
    readonly getVotingRoundsForTopic: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<VotingRoundSummary[], DbError>
    /** Paginated leaderboard rows for a topic and optional round. */
    readonly getLeaderboardPageForTopic: (params: {
      marathonId: number
      topicId: number
      page: number
      limit: number
      roundId?: number | null
    }) => Effect.Effect<LeaderboardPageRow[], DbError>
    /** Top ranked leaderboard preview for the resolved round. */
    readonly getTopRanksPreviewForTopic: (
      params: ResolveRoundInput,
    ) => Effect.Effect<TopRanksPreviewRow[], DbError>
    /** Leading vote tie for the topic, or none if not applicable. */
    readonly getLeadingTieForTopic: (params: {
      marathonId: number
      topicId: number
    }) => Effect.Effect<Option.Option<LeadingTieResult>, DbError>
    /** Paginated voters list for a topic and optional round. */
    readonly getVotersPageForTopic: (params: {
      marathonId: number
      topicId: number
      page: number
      limit: number
      roundId?: number | null
    }) => Effect.Effect<VotersPageRow[], DbError>
    /** Voting session by id scoped to marathon and topic, or none. */
    readonly getVotingSessionByIdForTopic: (params: {
      marathonId: number
      topicId: number
      sessionId: number
    }) => Effect.Effect<Option.Option<VotingSessionWithMarathon>, DbError>
    /** Per-submission vote stats in a marathon domain, or none. */
    readonly getSubmissionVoteStats: (params: {
      submissionId: number
      domain: string
    }) => Effect.Effect<Option.Option<SubmissionVoteStatsRow>, DbError>
    /** Participant vote status for a topic, or none if not found. */
    readonly getParticipantVoteInfo: (params: {
      participantId: number
      topicId: number
    }    ) => Effect.Effect<Option.Option<ParticipantVoteInfo>, DbError>
    /** Vote cast by a session in a round, or none if missing. */
    readonly getVotingRoundVoteForSession: (params: {
      roundId: number
      sessionId: number
    }) => Effect.Effect<Option.Option<VotingRoundVote>, DbError>
    /** Submissions available for voting in the resolved round. */
    readonly getSubmissionsForVoting: (
      params: ResolveRoundInput,
    ) => Effect.Effect<SubmissionForVotingRow[], DbError>
    /** Record or replace a vote for a session in a round. */
    readonly recordVote: (params: {
      roundId: number
      sessionId: number
      submissionId: number
    }) => Effect.Effect<VotingRoundVote | undefined, DbError>
    /** Remove a session's vote in a round. */
    readonly clearVote: (params: {
      roundId: number
      sessionId: number
    }) => Effect.Effect<VotingRoundVote | undefined, DbError>
    /** Delete a voting session by id. */
    readonly deleteVotingSession: (params: {
      sessionId: number
    }) => Effect.Effect<VotingSession | undefined, DbError>
    /** Patch contact fields on a voting session scoped to marathon and topic. */
    readonly updateVotingSessionContact: (params: {
      marathonId: number
      topicId: number
      sessionId: number
      patch: {
        email?: string
        phoneHash?: string | null
        phoneEncrypted?: string | null
      }
    }) => Effect.Effect<VotingSession | undefined, DbError>
  }
>()("@blikka/db/voting-repository") {}

const makeVotingRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const buildLeaderboardBase = (db: DrizzleDatabase, roundId: number) =>
    db
      .select({
        submissionId: sql<number>`${submissions.id}`.as("submission_id"),
        submissionCreatedAt: submissions.createdAt,
        submissionKey: submissions.key,
        submissionThumbnailKey: submissions.thumbnailKey,
        participantId: sql<number>`${participants.id}`.as("participant_id"),
        participantFirstName: participants.firstname,
        participantLastName: participants.lastname,
        participantReference: participants.reference,
        voteCount: sql<number>`count(${votingRoundVote.id})`.as("vote_count"),
      })
      .from(votingRoundSubmission)
      .innerJoin(submissions, eq(submissions.id, votingRoundSubmission.submissionId))
      .innerJoin(participants, eq(participants.id, submissions.participantId))
      .leftJoin(
        votingRoundVote,
        and(
          eq(votingRoundVote.roundId, votingRoundSubmission.roundId),
          eq(votingRoundVote.submissionId, submissions.id),
        ),
      )
      .where(eq(votingRoundSubmission.roundId, roundId))
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

  const buildRankedLeaderboard = (db: DrizzleDatabase, roundId: number) => {
    const leaderboardBase = buildLeaderboardBase(db, roundId)

    return db
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
  }

  const getVotingSessionByToken: VotingRepository["Service"]["getVotingSessionByToken"] = Effect.fn(
    "VotingRepository.getVotingSessionByToken",
  )(function* ({ token }) {
    const result = yield* use((database) =>
      database.query.votingSession.findFirst({
        where: (table, operators) => operators.eq(table.token, token),
        with: {
          marathon: true,
          topic: true,
        },
      }),
    )

    return Option.fromNullishOr(result)
  })

  const getVotingSessionsByIdsWithMarathon: VotingRepository["Service"]["getVotingSessionsByIdsWithMarathon"] =
    Effect.fn("VotingRepository.getVotingSessionsByIdsWithMarathon")(function* ({ ids }) {
      if (ids.length === 0) {
        return []
      }

      return yield* use((database) =>
        database.query.votingSession.findMany({
          where: (table, operators) => inArray(table.id, ids),
          columns: {
            id: true,
            token: true,
            phoneEncrypted: true,
            notificationLastSentAt: true,
          },
          with: {
            marathon: {
              columns: {
                domain: true,
                name: true,
              },
            },
          },
        }),
      )
    })

  const getParticipantsWithSubmissionsByTopicId: VotingRepository["Service"]["getParticipantsWithSubmissionsByTopicId"] =
    Effect.fn("VotingRepository.getParticipantsWithSubmissionsByTopicId")(function* ({
      marathonId,
      topicId,
    }) {
      const result = yield* use((database) =>
        database.query.participants.findMany({
          where: (table, operators) => operators.eq(table.marathonId, marathonId),
          with: {
            submissions: true,
          },
        }),
      )

      return result
        .filter((participant) =>
          participant.submissions.some((submission) => submission.topicId === topicId),
        )
        .map((participant) => ({
          ...participant,
          submissions: participant.submissions.filter(
            (submission) => submission.topicId === topicId,
          ),
        }))
    })

  const getParticipantsWithSubmissionsButNoVotingSession: VotingRepository["Service"]["getParticipantsWithSubmissionsButNoVotingSession"] =
    Effect.fn("VotingRepository.getParticipantsWithSubmissionsButNoVotingSession")(function* ({
      marathonId,
      topicId,
    }) {
      return yield* use((database) =>
        database
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
          .where(isNull(votingSession.id)),
      )
    })

  const createVotingSessions: VotingRepository["Service"]["createVotingSessions"] = Effect.fn(
    "VotingRepository.createVotingSessions",
  )(function* ({ sessions }) {
    if (sessions.length === 0) {
      return []
    }

    return yield* use((database) =>
      database
        .insert(votingSession)
        .values(sessions)
        .onConflictDoNothing({
          target: [votingSession.connectedParticipantId, votingSession.topicId],
        })
        .returning(),
    )
  })

  const updateMultipleLastNotificationSentAt: VotingRepository["Service"]["updateMultipleLastNotificationSentAt"] =
    Effect.fn("VotingRepository.updateLastNotificationSentAt")(function* ({
      ids,
      notificationLastSentAt,
    }) {
      if (ids.length === 0) {
        return
      }

      yield* use((database) =>
        database
          .update(votingSession)
          .set({ notificationLastSentAt })
          .where(inArray(votingSession.id, ids)),
      )
    })

  const countVotingSessionsForTopic: VotingRepository["Service"]["countVotingSessionsForTopic"] =
    Effect.fn("VotingRepository.countVotingSessionsForTopic")(function* ({ marathonId, topicId }) {
      const result = yield* use((database) =>
        database
          .select({ value: count() })
          .from(votingSession)
          .where(and(eq(votingSession.marathonId, marathonId), eq(votingSession.topicId, topicId))),
      )

      return result[0]?.value ?? 0
    })

  const createVotingRound: VotingRepository["Service"]["createVotingRound"] = Effect.fn(
    "VotingRepository.createVotingRound",
  )(function* (roundData) {
    const [result] = yield* use((database) =>
      database
        .insert(votingRound)
        .values(roundData)
        .onConflictDoNothing({
          target: [votingRound.topicId, votingRound.roundNumber],
        })
        .returning(),
    )

    return result as VotingRound | undefined
  })

  const createVotingRoundSubmissions: VotingRepository["Service"]["createVotingRoundSubmissions"] =
    Effect.fn("VotingRepository.createVotingRoundSubmissions")(function* ({
      roundId,
      submissionIds,
    }) {
      if (submissionIds.length === 0) {
        return []
      }

      const values: NewVotingRoundSubmission[] = submissionIds.map((submissionId) => ({
        roundId,
        submissionId,
      }))

      return yield* use((database) =>
        database
          .insert(votingRoundSubmission)
          .values(values)
          .onConflictDoNothing({
            target: [votingRoundSubmission.roundId, votingRoundSubmission.submissionId],
          })
          .returning(),
      )
    })

  const createVotingRoundVotes: VotingRepository["Service"]["createVotingRoundVotes"] = Effect.fn(
    "VotingRepository.createVotingRoundVotes",
  )(function* ({ votes }) {
    if (votes.length === 0) {
      return []
    }

    return yield* use((database) => database.insert(votingRoundVote).values(votes).returning())
  })

  const getVotingRoundById: VotingRepository["Service"]["getVotingRoundById"] = Effect.fn(
    "VotingRepository.getVotingRoundById",
  )(function* ({ marathonId, topicId, roundId }) {
    const result = yield* use((database) =>
      database.query.votingRound.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.id, roundId),
            operators.eq(table.marathonId, marathonId),
            operators.eq(table.topicId, topicId),
          ),
      }),
    )

    return Option.fromNullishOr(result)
  })

  const getLatestVotingRoundForTopic: VotingRepository["Service"]["getLatestVotingRoundForTopic"] =
    Effect.fn("VotingRepository.getLatestVotingRoundForTopic")(function* ({ marathonId, topicId }) {
      const result = yield* use((database) =>
        database.query.votingRound.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.marathonId, marathonId),
              operators.eq(table.topicId, topicId),
            ),
          orderBy: (table, operators) => [
            operators.desc(table.roundNumber),
            operators.desc(table.id),
          ],
        }),
      )

      return Option.fromNullishOr(result)
    })

  const getActiveVotingRoundForTopic: VotingRepository["Service"]["getActiveVotingRoundForTopic"] =
    Effect.fn("VotingRepository.getActiveVotingRoundForTopic")(function* ({ marathonId, topicId }) {
      const result = yield* use((database) =>
        database.query.votingRound.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.marathonId, marathonId),
              operators.eq(table.topicId, topicId),
              operators.isNull(table.endsAt),
            ),
          orderBy: (table, operators) => [
            operators.desc(table.roundNumber),
            operators.desc(table.id),
          ],
        }),
      )

      return Option.fromNullishOr(result)
    })

  const resolveRoundForTopic = Effect.fn("VotingRepository.resolveRoundForTopic")(function* ({
    marathonId,
    topicId,
    roundId,
  }: ResolveRoundInput) {
    if (roundId !== undefined && roundId !== null) {
      return yield* getVotingRoundById({
        marathonId,
        topicId,
        roundId,
      })
    }

    return yield* getLatestVotingRoundForTopic({
      marathonId,
      topicId,
    })
  })

  const getVotingSessionStatsForTopic: VotingRepository["Service"]["getVotingSessionStatsForTopic"] =
    Effect.fn("VotingRepository.getVotingSessionStatsForTopic")(function* ({
      marathonId,
      topicId,
    }) {
      const [sessionStatsResult, latestRoundOpt] = yield* Effect.all([
        use((database) =>
          database
            .select({
              total: sql<number>`count(*)`.as("total"),
              participantSessions: sql<number>`count(${votingSession.connectedParticipantId})`.as(
                "participant_sessions",
              ),
              manualSessions:
                sql<number>`count(*) - count(${votingSession.connectedParticipantId})`.as(
                  "manual_sessions",
                ),
            })
            .from(votingSession)
            .where(
              and(eq(votingSession.marathonId, marathonId), eq(votingSession.topicId, topicId)),
            ),
        ),
        getLatestVotingRoundForTopic({ marathonId, topicId }),
      ])

      const latestRound = Option.getOrUndefined(latestRoundOpt)
      if (!latestRound) {
        const sessionStats = sessionStatsResult[0]
        return {
          total: sessionStats?.total ?? 0,
          completed: 0,
          participantSessions: sessionStats?.participantSessions ?? 0,
          manualSessions: sessionStats?.manualSessions ?? 0,
        }
      }

      const completedResult = yield* use((database) =>
        database
          .select({ value: count() })
          .from(votingRoundVote)
          .where(eq(votingRoundVote.roundId, latestRound.id)),
      )

      const sessionStats = sessionStatsResult[0]

      return {
        total: sessionStats?.total ?? 0,
        completed: completedResult[0]?.value ?? 0,
        participantSessions: sessionStats?.participantSessions ?? 0,
        manualSessions: sessionStats?.manualSessions ?? 0,
      }
    })

  const getVotingWindowForTopic: VotingRepository["Service"]["getVotingWindowForTopic"] = Effect.fn(
    "VotingRepository.getVotingWindowForTopic",
  )(function* ({ marathonId, topicId }) {
    const roundOpt = yield* getLatestVotingRoundForTopic({
      marathonId,
      topicId,
    })
    const round = Option.getOrUndefined(roundOpt)

    if (!round) {
      return undefined
    }

    return {
      startsAt: round.startedAt,
      endsAt: round.endsAt,
    }
  })

  const updateVotingRoundWindow: VotingRepository["Service"]["updateVotingRoundWindow"] = Effect.fn(
    "VotingRepository.updateVotingRoundWindow",
  )(function* ({ roundId, startedAt, endsAt, updatedAt }) {
    const result = yield* use((database) =>
      database
        .update(votingRound)
        .set({
          ...(startedAt ? { startedAt } : {}),
          endsAt,
          updatedAt,
        })
        .where(eq(votingRound.id, roundId))
        .returning(),
    )

    return result[0] as VotingRound | undefined
  })

  const closeTopicVotingWindow: VotingRepository["Service"]["closeTopicVotingWindow"] = Effect.fn(
    "VotingRepository.closeTopicVotingWindow",
  )(function* ({ marathonId, topicId, nowIso }) {
    const latestRoundOpt = yield* getLatestVotingRoundForTopic({
      marathonId,
      topicId,
    })
    const latestRound = Option.getOrUndefined(latestRoundOpt)

    if (!latestRound) {
      return undefined
    }

    const updatedRound = yield* updateVotingRoundWindow({
      roundId: latestRound.id,
      startedAt:
        new Date(latestRound.startedAt).getTime() >= new Date(nowIso).getTime()
          ? new Date(new Date(nowIso).getTime() - 1000).toISOString()
          : undefined,
      endsAt: nowIso,
      updatedAt: nowIso,
    })

    if (!updatedRound) {
      return undefined
    }

    return {
      startsAt: updatedRound.startedAt,
      endsAt: updatedRound.endsAt,
    }
  })

  const reopenTopicVotingWindow: VotingRepository["Service"]["reopenTopicVotingWindow"] = Effect.fn(
    "VotingRepository.reopenTopicVotingWindow",
  )(function* ({ marathonId, topicId, nowIso }) {
    const latestRoundOpt = yield* getLatestVotingRoundForTopic({
      marathonId,
      topicId,
    })
    const latestRound = Option.getOrUndefined(latestRoundOpt)

    if (!latestRound) {
      return undefined
    }

    const updatedRound = yield* updateVotingRoundWindow({
      roundId: latestRound.id,
      endsAt: null,
      updatedAt: nowIso,
    })

    if (!updatedRound) {
      return undefined
    }

    return {
      startsAt: updatedRound.startedAt,
      endsAt: updatedRound.endsAt,
    }
  })

  const closeVotingWindowsForTopics: VotingRepository["Service"]["closeVotingWindowsForTopics"] =
    Effect.fn("VotingRepository.closeVotingWindowsForTopics")(function* ({
      marathonId,
      topicIds,
      nowIso,
    }) {
      if (topicIds.length === 0) {
        return []
      }

      return yield* use((database) =>
        database
          .update(votingRound)
          .set({
            startedAt: sql`case
            when ${votingRound.startedAt} >= ${nowIso}::timestamptz
              then ${nowIso}::timestamptz - interval '1 second'
            else ${votingRound.startedAt}
          end`,
            endsAt: sql`${nowIso}::timestamptz`,
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(votingRound.marathonId, marathonId),
              inArray(votingRound.topicId, [...topicIds]),
              sql`(${votingRound.endsAt} is null or ${votingRound.endsAt} > ${nowIso}::timestamptz)`,
            ),
          )
          .returning({
            topicId: votingRound.topicId,
            startsAt: votingRound.startedAt,
            endsAt: votingRound.endsAt,
          }),
      )
    })

  const countSubmissionsForTopic: VotingRepository["Service"]["countSubmissionsForTopic"] =
    Effect.fn("VotingRepository.countSubmissionsForTopic")(function* ({ marathonId, topicId }) {
      const result = yield* use((database) =>
        database
          .select({ value: count() })
          .from(submissions)
          .where(and(eq(submissions.marathonId, marathonId), eq(submissions.topicId, topicId))),
      )

      return result[0]?.value ?? 0
    })

  const countParticipantsWithSubmissionsForTopic: VotingRepository["Service"]["countParticipantsWithSubmissionsForTopic"] =
    Effect.fn("VotingRepository.countParticipantsWithSubmissionsForTopic")(function* ({
      marathonId,
      topicId,
    }) {
      const result = yield* use((database) =>
        database
          .select({
            value: sql<number>`count(distinct ${submissions.participantId})`.as("value"),
          })
          .from(submissions)
          .where(and(eq(submissions.marathonId, marathonId), eq(submissions.topicId, topicId))),
      )

      return result[0]?.value ?? 0
    })

  const countVotingRoundSubmissionsForTopic: VotingRepository["Service"]["countVotingRoundSubmissionsForTopic"] =
    Effect.fn("VotingRepository.countVotingRoundSubmissionsForTopic")(function* ({
      marathonId,
      topicId,
      roundId,
    }) {
      const roundOpt = yield* resolveRoundForTopic({
        marathonId,
        topicId,
        roundId,
      })

      const round = Option.getOrUndefined(roundOpt)
      if (!round) {
        return 0
      }

      const result = yield* use((database) =>
        database
          .select({ value: count() })
          .from(votingRoundSubmission)
          .where(eq(votingRoundSubmission.roundId, round.id)),
      )

      return result[0]?.value ?? 0
    })

  const getVotingRoundsForTopic: VotingRepository["Service"]["getVotingRoundsForTopic"] = Effect.fn(
    "VotingRepository.getVotingRoundsForTopic",
  )(function* ({ marathonId, topicId }) {
    return yield* use((database) =>
      database
        .select({
          id: votingRound.id,
          roundNumber: votingRound.roundNumber,
          kind: votingRound.kind,
          sourceRoundId: votingRound.sourceRoundId,
          startedAt: votingRound.startedAt,
          endsAt: votingRound.endsAt,
        })
        .from(votingRound)
        .where(and(eq(votingRound.marathonId, marathonId), eq(votingRound.topicId, topicId)))
        .orderBy(asc(votingRound.roundNumber)),
    )
  })

  const getLeaderboardPageForTopic: VotingRepository["Service"]["getLeaderboardPageForTopic"] =
    Effect.fn("VotingRepository.getLeaderboardPageForTopic")(function* ({
      marathonId,
      topicId,
      page,
      limit,
      roundId,
    }) {
      const roundOpt = yield* resolveRoundForTopic({
        marathonId,
        topicId,
        roundId,
      })
      const round = Option.getOrUndefined(roundOpt)

      if (!round) {
        return []
      }

      const offset = (page - 1) * limit

      return yield* use((database) => {
        const rankedLeaderboard = buildRankedLeaderboard(database, round.id)
        return database
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
    })

  const getTopRanksPreviewForTopic: VotingRepository["Service"]["getTopRanksPreviewForTopic"] =
    Effect.fn("VotingRepository.getTopRanksPreviewForTopic")(function* ({
      marathonId,
      topicId,
      roundId,
    }) {
      const roundOpt = yield* resolveRoundForTopic({
        marathonId,
        topicId,
        roundId,
      })
      const round = Option.getOrUndefined(roundOpt)

      if (!round) {
        return []
      }

      return yield* use((database) => {
        const rankedLeaderboard = buildRankedLeaderboard(database, round.id)
        const rankedPreview = database
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
              order by ${rankedLeaderboard.submissionCreatedAt} asc, ${rankedLeaderboard.submissionId} asc
            )`.as("rank_entry_order"),
          })
          .from(rankedLeaderboard)
          .as("ranked_preview")

        return database
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
          .where(and(sql`${rankedPreview.rank} <= 3`, sql`${rankedPreview.rankEntryOrder} <= 3`))
          .orderBy(asc(rankedPreview.rank), asc(rankedPreview.rankEntryOrder))
      })
    })

  const getLeadingTieForTopic: VotingRepository["Service"]["getLeadingTieForTopic"] = Effect.fn(
    "VotingRepository.getLeadingTieForTopic",
  )(function* ({ marathonId, topicId }) {
    const roundOpt = yield* getLatestVotingRoundForTopic({
      marathonId,
      topicId,
    })
    const round = Option.getOrUndefined(roundOpt)

    if (!round) {
      return Option.none<{
        roundId: number
        roundNumber: number
        roundKind: string
        voteCount: number
        tieSize: number
        submissionIds: number[]
      }>()
    }

    const firstRankRows = yield* use((database) => {
      const rankedLeaderboard = buildRankedLeaderboard(database, round.id)
      return database
        .select({
          submissionId: rankedLeaderboard.submissionId,
          voteCount: rankedLeaderboard.voteCount,
          rank: rankedLeaderboard.rank,
          tieSize: rankedLeaderboard.tieSize,
        })
        .from(rankedLeaderboard)
        .where(sql`${rankedLeaderboard.rank} = 1`)
        .orderBy(asc(rankedLeaderboard.submissionCreatedAt), asc(rankedLeaderboard.submissionId))
    })

    const leadingRow = firstRankRows[0]
    if (!leadingRow || leadingRow.tieSize <= 1) {
      return Option.none()
    }

    return Option.some({
      roundId: round.id,
      roundNumber: round.roundNumber,
      roundKind: round.kind,
      voteCount: leadingRow.voteCount,
      tieSize: leadingRow.tieSize,
      submissionIds: firstRankRows.map((row) => row.submissionId),
    })
  })

  const getVotersPageForTopic: VotingRepository["Service"]["getVotersPageForTopic"] = Effect.fn(
    "VotingRepository.getVotersPageForTopic",
  )(function* ({ marathonId, topicId, page, limit, roundId }) {
    const roundOpt = yield* resolveRoundForTopic({
      marathonId,
      topicId,
      roundId,
    })
    const round = Option.getOrUndefined(roundOpt)
    const offset = (page - 1) * limit

    return yield* use((database) =>
      database
        .select({
          id: votingSession.id,
          firstName: votingSession.firstName,
          lastName: votingSession.lastName,
          email: votingSession.email,
          token: votingSession.token,
          phoneEncrypted: votingSession.phoneEncrypted,
          notificationLastSentAt: votingSession.notificationLastSentAt,
          connectedParticipantId: votingSession.connectedParticipantId,
          votedAt: round
            ? sql<string | null>`${votingRoundVote.votedAt}`.as("voted_at")
            : sql<string | null>`null`.as("voted_at"),
          voteSubmissionId: round
            ? sql<number | null>`${votingRoundVote.submissionId}`.as("vote_submission_id")
            : sql<number | null>`null`.as("vote_submission_id"),
          voteSubmissionKey: submissions.key,
          voteSubmissionThumbnailKey: submissions.thumbnailKey,
          voteSubmissionCreatedAt: submissions.createdAt,
          voteParticipantId: participants.id,
          voteParticipantReference: participants.reference,
          voteParticipantFirstName: participants.firstname,
          voteParticipantLastName: participants.lastname,
        })
        .from(votingSession)
        .leftJoin(
          votingRoundVote,
          round
            ? and(
                eq(votingRoundVote.sessionId, votingSession.id),
                eq(votingRoundVote.roundId, round.id),
              )
            : sql`false`,
        )
        .leftJoin(submissions, eq(submissions.id, votingRoundVote.submissionId))
        .leftJoin(participants, eq(participants.id, submissions.participantId))
        .where(and(eq(votingSession.marathonId, marathonId), eq(votingSession.topicId, topicId)))
        .orderBy(desc(votingSession.createdAt), desc(votingSession.id))
        .limit(limit)
        .offset(offset),
    )
  })

  const getVotingSessionByIdForTopic: VotingRepository["Service"]["getVotingSessionByIdForTopic"] =
    Effect.fn("VotingRepository.getVotingSessionByIdForTopic")(function* ({
      marathonId,
      topicId,
      sessionId,
    }) {
      const result = yield* use((database) =>
        database.query.votingSession.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.id, sessionId),
              operators.eq(table.marathonId, marathonId),
              operators.eq(table.topicId, topicId),
            ),
          with: {
            marathon: true,
          },
        }),
      )

      return Option.fromNullishOr(result)
    })

  const getSubmissionVoteStats: VotingRepository["Service"]["getSubmissionVoteStats"] = Effect.fn(
    "VotingRepository.getSubmissionVoteStats",
  )(function* ({ submissionId, domain }) {
    const marathonResult = yield* use((database) =>
      database.query.marathons.findFirst({
        where: (table, operators) => operators.eq(table.domain, domain),
        columns: { id: true },
      }),
    )

    if (!marathonResult) {
      return Option.none<SubmissionVoteStatsRow>()
    }

    const submissionResult = yield* use((database) =>
      database.query.submissions.findFirst({
        where: (table, operators) => operators.eq(table.id, submissionId),
        columns: {
          id: true,
          marathonId: true,
          topicId: true,
        },
      }),
    )

    if (!submissionResult || submissionResult.marathonId !== marathonResult.id) {
      return Option.none<SubmissionVoteStatsRow>()
    }

    const roundOpt = yield* resolveRoundForTopic({
      marathonId: marathonResult.id,
      topicId: submissionResult.topicId,
    })
    const round = Option.getOrUndefined(roundOpt)

    if (!round) {
      return Option.some<SubmissionVoteStatsRow>({
        voteCount: 0,
        position: null,
        totalSubmissions: 0,
        roundId: null,
        roundNumber: null,
        roundKind: null,
      })
    }

    const totalSubmissions = yield* countVotingRoundSubmissionsForTopic({
      marathonId: marathonResult.id,
      topicId: submissionResult.topicId,
      roundId: round.id,
    })

    const entryRow = yield* use((database) => {
      const rankedLeaderboard = buildRankedLeaderboard(database, round.id)
      return database
        .select({
          voteCount: rankedLeaderboard.voteCount,
          rank: rankedLeaderboard.rank,
        })
        .from(rankedLeaderboard)
        .where(eq(rankedLeaderboard.submissionId, submissionId))
        .limit(1)
    })

    const entry = entryRow[0]
    if (!entry) {
      return Option.some<SubmissionVoteStatsRow>({
        voteCount: 0,
        position: null,
        totalSubmissions,
        roundId: round.id,
        roundNumber: round.roundNumber,
        roundKind: round.kind,
      })
    }

    return Option.some<SubmissionVoteStatsRow>({
      voteCount: entry.voteCount,
      position: entry.rank,
      totalSubmissions,
      roundId: round.id,
      roundNumber: round.roundNumber,
      roundKind: round.kind,
    })
  })

  const getParticipantVoteInfo: VotingRepository["Service"]["getParticipantVoteInfo"] = Effect.fn(
    "VotingRepository.getParticipantVoteInfo",
  )(function* ({ participantId, topicId }) {
    const votingSessionResult = yield* use((database) =>
      database.query.votingSession.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.connectedParticipantId, participantId),
            operators.eq(table.topicId, topicId),
          ),
      }),
    )

    if (!votingSessionResult) {
      return Option.none()
    }

    const latestRoundOpt = yield* getLatestVotingRoundForTopic({
      marathonId: votingSessionResult.marathonId,
      topicId,
    })
    const latestRound = Option.getOrUndefined(latestRoundOpt)

    if (!latestRound) {
      const emptyVoteInfo: ParticipantVoteInfo = {
        hasVoted: false,
        votedAt: null,
        votedSubmissionId: null,
        votedTopicName: null,
        roundId: null,
        roundNumber: null,
        roundKind: null,
      }

      return Option.some(emptyVoteInfo)
    }

    const voteResult = yield* use((database) =>
      database
        .select({
          votedAt: votingRoundVote.votedAt,
          votedSubmissionId: votingRoundVote.submissionId,
          votedTopicName: topics.name,
        })
        .from(votingRoundVote)
        .innerJoin(submissions, eq(submissions.id, votingRoundVote.submissionId))
        .innerJoin(topics, eq(topics.id, submissions.topicId))
        .where(
          and(
            eq(votingRoundVote.roundId, latestRound.id),
            eq(votingRoundVote.sessionId, votingSessionResult.id),
          ),
        )
        .limit(1),
    )

    const vote = voteResult[0]

    const participantVoteInfo: ParticipantVoteInfo = {
      hasVoted: !!vote,
      votedAt: vote?.votedAt ?? null,
      votedSubmissionId: vote?.votedSubmissionId ?? null,
      votedTopicName: vote?.votedTopicName ?? null,
      roundId: latestRound.id,
      roundNumber: latestRound.roundNumber,
      roundKind: latestRound.kind,
    }

    return Option.some(participantVoteInfo)
  })

  const getVotingRoundVoteForSession: VotingRepository["Service"]["getVotingRoundVoteForSession"] =
    Effect.fn("VotingRepository.getVotingRoundVoteForSession")(function* ({ roundId, sessionId }) {
      const result = yield* use((database) =>
        database.query.votingRoundVote.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.roundId, roundId),
              operators.eq(table.sessionId, sessionId),
            ),
        }),
      )

      return Option.fromNullishOr(result)
    })

  const getSubmissionsForVoting: VotingRepository["Service"]["getSubmissionsForVoting"] = Effect.fn(
    "VotingRepository.getSubmissionsForVoting",
  )(function* ({ marathonId, topicId, roundId }) {
    const roundOpt = yield* resolveRoundForTopic({
      marathonId,
      topicId,
      roundId,
    })
    const round = Option.getOrUndefined(roundOpt)

    if (!round) {
      return []
    }

    return yield* use((database) =>
      database
        .select({
          id: submissions.id,
          participantId: submissions.participantId,
          key: submissions.key,
          thumbnailKey: submissions.thumbnailKey,
          previewKey: submissions.previewKey,
          topicId: submissions.topicId,
          participant: {
            id: participants.id,
            firstname: participants.firstname,
            lastname: participants.lastname,
          },
          topic: {
            id: topics.id,
            name: topics.name,
          },
        })
        .from(votingRoundSubmission)
        .innerJoin(submissions, eq(submissions.id, votingRoundSubmission.submissionId))
        .innerJoin(participants, eq(participants.id, submissions.participantId))
        .innerJoin(topics, eq(topics.id, submissions.topicId))
        .where(and(eq(votingRoundSubmission.roundId, round.id), eq(submissions.status, "uploaded")))
        .orderBy(asc(submissions.id)),
    )
  })

  const recordVote: VotingRepository["Service"]["recordVote"] = Effect.fn(
    "VotingRepository.recordVote",
  )(function* ({ roundId, sessionId, submissionId }) {
    const now = new Date().toISOString()
    const values: NewVotingRoundVote = {
      roundId,
      sessionId,
      submissionId,
      votedAt: now,
    }

    const result = yield* use((database) =>
      database.insert(votingRoundVote).values(values).returning(),
    )

    return result[0]
  })

  const clearVote: VotingRepository["Service"]["clearVote"] = Effect.fn(
    "VotingRepository.clearVote",
  )(function* ({ roundId, sessionId }) {
    const result = yield* use((database) =>
      database
        .delete(votingRoundVote)
        .where(and(eq(votingRoundVote.roundId, roundId), eq(votingRoundVote.sessionId, sessionId)))
        .returning(),
    )

    return result[0]
  })

  const deleteVotingSession: VotingRepository["Service"]["deleteVotingSession"] = Effect.fn(
    "VotingRepository.deleteVotingSession",
  )(function* ({ sessionId }) {
    const result = yield* use((database) =>
      database.delete(votingSession).where(eq(votingSession.id, sessionId)).returning(),
    )

    return result[0] as VotingSession | undefined
  })

  const updateVotingSessionContact: VotingRepository["Service"]["updateVotingSessionContact"] =
    Effect.fn("VotingRepository.updateVotingSessionContact")(function* ({
      marathonId,
      topicId,
      sessionId,
      patch,
    }) {
      const result = yield* use((database) =>
        database
          .update(votingSession)
          .set({
            ...patch,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(votingSession.id, sessionId),
              eq(votingSession.marathonId, marathonId),
              eq(votingSession.topicId, topicId),
            ),
          )
          .returning(),
      )

      return result[0] as VotingSession | undefined
    })

  return VotingRepository.of({
    getVotingSessionByToken,
    getVotingSessionsByIdsWithMarathon,
    getParticipantsWithSubmissionsByTopicId,
    getParticipantsWithSubmissionsButNoVotingSession,
    createVotingSessions,
    updateMultipleLastNotificationSentAt,
    countVotingSessionsForTopic,
    createVotingRound,
    createVotingRoundSubmissions,
    createVotingRoundVotes,
    getVotingRoundById,
    getLatestVotingRoundForTopic,
    getActiveVotingRoundForTopic,
    getVotingSessionStatsForTopic,
    getVotingWindowForTopic,
    updateVotingRoundWindow,
    closeTopicVotingWindow,
    reopenTopicVotingWindow,
    closeVotingWindowsForTopics,
    countSubmissionsForTopic,
    countParticipantsWithSubmissionsForTopic,
    countVotingRoundSubmissionsForTopic,
    getVotingRoundsForTopic,
    getLeaderboardPageForTopic,
    getTopRanksPreviewForTopic,
    getLeadingTieForTopic,
    getVotersPageForTopic,
    getVotingSessionByIdForTopic,
    getSubmissionVoteStats,
    getParticipantVoteInfo,
    getVotingRoundVoteForSession,
    getSubmissionsForVoting,
    recordVote,
    clearVote,
    deleteVotingSession,
    updateVotingSessionContact,
  })
})

export const VotingRepositoryLayerNoDeps = Layer.effect(VotingRepository, makeVotingRepository)

export const VotingRepositoryLayer = VotingRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
