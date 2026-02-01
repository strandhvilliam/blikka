import { Effect, Option } from "effect";
import { DrizzleClient } from "../drizzle-client";
import {
  votingSession,
  marathons,
  participants,
  submissions,
  topics,
} from "../schema";
import { eq, inArray, sql, count, and, desc } from "drizzle-orm";
import type { NewVotingSession } from "../types";

export class VotingQueries extends Effect.Service<VotingQueries>()(
  "@blikka/db/voting-queries",
  {
    dependencies: [DrizzleClient.Default],
    effect: Effect.gen(function* () {
      const db = yield* DrizzleClient;

      const getVotingSessionByToken = Effect.fn(
        "VotingQueries.getVotingSessionByToken",
      )(function* ({ token }: { token: string }) {
        const result = yield* db.query.votingSession.findFirst({
          where: eq(votingSession.token, token),
          with: {
            marathon: true,
          },
        });
        return Option.fromNullable(result);
      });

      const getPublicMarathonByDomain = Effect.fn(
        "VotingQueries.getPublicMarathonByDomain",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
          columns: {
            id: true,
            name: true,
            domain: true,
            logoUrl: true,
            description: true,
            startDate: true,
            endDate: true,
          },
        });
        return Option.fromNullable(result);
      });

      const getParticipantsWithSubmissionsByMarathonId = Effect.fn(
        "VotingQueries.getParticipantsWithSubmissionsByMarathonId",
      )(function* ({ marathonId }: { marathonId: number }) {
        const result = yield* db.query.participants.findMany({
          where: eq(participants.marathonId, marathonId),
          with: {
            submissions: {
              limit: 1,
              columns: {
                id: true,
              },
            },
          },
        });
        return result;
      });

      const createVotingSessions = Effect.fn(
        "VotingQueries.createVotingSessions",
      )(function* ({ sessions }: { sessions: NewVotingSession[] }) {
        if (sessions.length === 0) {
          return [];
        }
        const result = yield* db
          .insert(votingSession)
          .values(sessions)
          .returning();
        return result;
      });

      const updateMultipleLastNotificationSentAt = Effect.fn(
        "VotingQueries.updateLastNotificationSentAt",
      )(function* ({
        ids,
        notificationLastSentAt,
      }: {
        ids: number[];
        notificationLastSentAt: string | null;
      }) {
        yield* db
          .update(votingSession)
          .set({ notificationLastSentAt })
          .where(inArray(votingSession.id, ids));
      });

      const getSubmissionVoteStats = Effect.fn(
        "VotingQueries.getSubmissionVoteStats",
      )(function* ({
        submissionId,
        domain,
      }: {
        submissionId: number;
        domain: string;
      }) {
        // Get marathon by domain first
        const marathonResult = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
          columns: {
            id: true,
          },
        });

        if (!marathonResult) {
          return Option.none();
        }

        const marathonId = marathonResult.id;

        // Count votes for this submission
        const voteCountResult = yield* db
          .select({ count: count() })
          .from(votingSession)
          .where(eq(votingSession.voteSubmissionId, submissionId));

        const voteCount = voteCountResult[0]?.count ?? 0;

        // Get all submissions in marathon with their vote counts
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
          .groupBy(submissions.id);

        // Calculate position (rank) - higher votes = better position
        const position =
          allSubmissionsWithVotes.filter((s) => s.voteCount > voteCount)
            .length + 1;

        const totalSubmissions = allSubmissionsWithVotes.length;

        return Option.some({
          voteCount,
          position,
          totalSubmissions,
        });
      });

      const getParticipantVoteInfo = Effect.fn(
        "VotingQueries.getParticipantVoteInfo",
      )(function* ({ participantId }: { participantId: number }) {
        const votingSessionResult = yield* db.query.votingSession.findFirst({
          where: eq(votingSession.connectedParticipantId, participantId),
          with: {
            submissions: {
              with: {
                topic: true,
              },
            },
          },
        });

        if (!votingSessionResult) {
          return Option.none();
        }

        return Option.some({
          hasVoted: votingSessionResult.votedAt !== null,
          votedAt: votingSessionResult.votedAt,
          votedSubmissionId: votingSessionResult.voteSubmissionId,
          votedTopicName: votingSessionResult.submissions?.topic?.name ?? null,
        });
      });

      return {
        getVotingSessionByToken,
        getPublicMarathonByDomain,
        getParticipantsWithSubmissionsByMarathonId,
        createVotingSessions,
        updateMultipleLastNotificationSentAt,
        getSubmissionVoteStats,
        getParticipantVoteInfo,
      } as const;
    }),
  },
) {}
