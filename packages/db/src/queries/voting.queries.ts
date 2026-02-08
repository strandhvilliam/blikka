import { Effect, Option } from "effect";
import { DrizzleClient } from "../drizzle-client";
import { votingSession, marathons, participants, submissions } from "../schema";
import { eq, inArray, sql, count, and, desc, asc } from "drizzle-orm";
import type { NewVotingSession, VotingSession } from "../types";

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
            topic: true,
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

      const getParticipantsWithSubmissionsByTopicId = Effect.fn(
        "VotingQueries.getParticipantsWithSubmissionsByMarathonId",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        const result = yield* db.query.participants.findMany({
          where: and(eq(participants.marathonId, marathonId)),
          with: {
            submissions: true,
          },
        });

        return result
          .filter((p) => p.submissions.some((s) => s.topicId === topicId))
          .map((p) => ({
            ...p,
            submissions: p.submissions.filter((s) => s.topicId === topicId),
          }));
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

      const countVotingSessionsForTopic = Effect.fn(
        "VotingQueries.countVotingSessionsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        const result = yield* db
          .select({ value: count() })
          .from(votingSession)
          .where(
            and(
              eq(votingSession.marathonId, marathonId),
              eq(votingSession.topicId, topicId),
            ),
          );

        return result[0]?.value ?? 0;
      });

      const getVotingSessionsForTopic = Effect.fn(
        "VotingQueries.getVotingSessionsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        return yield* db.query.votingSession.findMany({
          where: and(
            eq(votingSession.marathonId, marathonId),
            eq(votingSession.topicId, topicId),
          ),
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
          orderBy: [desc(votingSession.createdAt)],
        });
      });

      const getSubmissionVoteLeaderboardForTopic = Effect.fn(
        "VotingQueries.getSubmissionVoteLeaderboardForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
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
          );
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

        const voteCountResult = yield* db
          .select({ count: count() })
          .from(votingSession)
          .where(eq(votingSession.voteSubmissionId, submissionId));

        const voteCount = voteCountResult[0]?.count ?? 0;

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
      )(function* ({
        participantId,
        topicId,
      }: {
        participantId: number;
        topicId: number;
      }) {
        const votingSessionResult = yield* db.query.votingSession.findFirst({
          where: and(
            eq(votingSession.connectedParticipantId, participantId),
            eq(votingSession.topicId, topicId),
          ),
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

      const getVotingSessionByParticipantId = Effect.fn(
        "VotingQueries.getVotingSessionByParticipantId",
      )(function* ({ participantId }: { participantId: number }) {
        const result = yield* db.query.votingSession.findFirst({
          where: eq(votingSession.connectedParticipantId, participantId),
          orderBy: [desc(votingSession.createdAt)],
        });

        return Option.fromNullable(result);
      });

      const getVotingSessionByParticipantAndTopicId = Effect.fn(
        "VotingQueries.getVotingSessionByParticipantAndTopicId",
      )(function* ({
        participantId,
        topicId,
      }: {
        participantId: number;
        topicId: number;
      }) {
        const result = yield* db.query.votingSession.findFirst({
          where: and(
            eq(votingSession.connectedParticipantId, participantId),
            eq(votingSession.topicId, topicId),
          ),
          orderBy: [desc(votingSession.createdAt)],
        });

        return Option.fromNullable(result);
      });

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
              startsAt: sessionData.startsAt,
              endsAt: sessionData.endsAt,
              notificationLastSentAt: sessionData.notificationLastSentAt,
              updatedAt: new Date().toISOString(),
            },
          })
          .returning();

        return result[0] as VotingSession;
      });

      const getSubmissionsForVoting = Effect.fn(
        "VotingQueries.getSubmissionsForVoting",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        const result = yield* db.query.submissions.findMany({
          where: and(
            eq(submissions.marathonId, marathonId),
            eq(submissions.topicId, topicId),
          ),
          orderBy: submissions.id,
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
        });

        return result;
      });

      const recordVote = Effect.fn("VotingQueries.recordVote")(function* ({
        token,
        submissionId,
      }: {
        token: string;
        submissionId: number;
      }) {
        const now = new Date().toISOString();
        const result = yield* db
          .update(votingSession)
          .set({
            voteSubmissionId: submissionId,
            votedAt: now,
            updatedAt: now,
          })
          .where(eq(votingSession.token, token))
          .returning();

        return result[0] as VotingSession | undefined;
      });

      return {
        getVotingSessionByToken,
        getPublicMarathonByDomain,
        getParticipantsWithSubmissionsByTopicId,
        createVotingSessions,
        updateMultipleLastNotificationSentAt,
        countVotingSessionsForTopic,
        getVotingSessionsForTopic,
        getSubmissionVoteLeaderboardForTopic,
        getSubmissionVoteStats,
        getParticipantVoteInfo,
        getVotingSessionByParticipantId,
        getVotingSessionByParticipantAndTopicId,
        upsertVotingSession,
        getSubmissionsForVoting,
        recordVote,
      } as const;
    }),
  },
) {}
