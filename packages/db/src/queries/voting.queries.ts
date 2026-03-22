import { Effect, Layer, Option, ServiceMap } from "effect";
import { DrizzleClient } from "../drizzle-client";
import {
  marathons,
  participants,
  submissions,
  topics,
  votingRound,
  votingRoundSubmission,
  votingRoundVote,
  votingSession,
} from "../schema";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  NewVotingRound,
  NewVotingRoundSubmission,
  NewVotingRoundVote,
  NewVotingSession,
  VotingRound,
  VotingSession,
} from "../types";

type ResolveRoundInput = {
  marathonId: number;
  topicId: number;
  roundId?: number | null;
};

type LeaderboardEntry = {
  submissionId: number;
  submissionCreatedAt: string;
  submissionKey: string | null;
  submissionThumbnailKey: string | null;
  participantId: number;
  participantFirstName: string;
  participantLastName: string;
  participantReference: string;
  voteCount: number;
  rank: number;
  tieSize: number;
};

type ParticipantVoteInfo = {
  hasVoted: boolean;
  votedAt: string | null;
  votedSubmissionId: number | null;
  votedTopicName: string | null;
  roundId: number | null;
  roundNumber: number | null;
  roundKind: string | null;
};

type SubmissionVoteStatsRow = {
  voteCount: number;
  position: number | null;
  totalSubmissions: number;
  roundId: number | null;
  roundNumber: number | null;
  roundKind: string | null;
};

export class VotingQueries extends ServiceMap.Service<VotingQueries>()(
  "@blikka/db/voting-queries",
  {
    make: Effect.gen(function* () {
      const { client: db, use } = yield* DrizzleClient;

      const buildLeaderboardBase = (roundId: number) =>
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
            voteCount: sql<number>`count(${votingRoundVote.id})`.as(
              "vote_count",
            ),
          })
          .from(votingRoundSubmission)
          .innerJoin(
            submissions,
            eq(submissions.id, votingRoundSubmission.submissionId),
          )
          .innerJoin(
            participants,
            eq(participants.id, submissions.participantId),
          )
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
          .as("leaderboard_base");

      const buildRankedLeaderboard = (roundId: number) => {
        const leaderboardBase = buildLeaderboardBase(roundId);

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
            tieSize:
              sql<number>`count(*) over (partition by ${leaderboardBase.voteCount})`.as(
                "tie_size",
              ),
          })
          .from(leaderboardBase)
          .as("ranked_leaderboard");
      };

      const getVotingSessionByToken = Effect.fn(
        "VotingQueries.getVotingSessionByToken",
      )(function* ({ token }: { token: string }) {
        const result = yield* use((database) =>
          database.query.votingSession.findFirst({
            where: (table, operators) => operators.eq(table.token, token),
            with: {
              marathon: true,
              topic: true,
            },
          }),
        );

        return Option.fromNullishOr(result);
      });

      const getVotingSessionsByIdsWithMarathon = Effect.fn(
        "VotingQueries.getVotingSessionsByIdsWithMarathon",
      )(function* ({ ids }: { ids: number[] }) {
        if (ids.length === 0) {
          return [];
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
        );
      });

      const getPublicMarathonByDomain = Effect.fn(
        "VotingQueries.getPublicMarathonByDomain",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* use((database) =>
          database.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
            columns: {
              id: true,
              name: true,
              domain: true,
              logoUrl: true,
              description: true,
              startDate: true,
              endDate: true,
            },
          }),
        );

        return Option.fromNullishOr(result);
      });

      const getParticipantsWithSubmissionsByTopicId = Effect.fn(
        "VotingQueries.getParticipantsWithSubmissionsByTopicId",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        const result = yield* use((database) =>
          database.query.participants.findMany({
            where: (table, operators) =>
              operators.eq(table.marathonId, marathonId),
            with: {
              submissions: true,
            },
          }),
        );

        return result
          .filter((participant) =>
            participant.submissions.some(
              (submission) => submission.topicId === topicId,
            ),
          )
          .map((participant) => ({
            ...participant,
            submissions: participant.submissions.filter(
              (submission) => submission.topicId === topicId,
            ),
          }));
      });

      const getParticipantsWithSubmissionsButNoVotingSession = Effect.fn(
        "VotingQueries.getParticipantsWithSubmissionsButNoVotingSession",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
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
        );
      });

      const createVotingSessions = Effect.fn(
        "VotingQueries.createVotingSessions",
      )(function* ({ sessions }: { sessions: NewVotingSession[] }) {
        if (sessions.length === 0) {
          return [];
        }

        return yield* use((database) =>
          database
            .insert(votingSession)
            .values(sessions)
            .onConflictDoNothing({
              target: [
                votingSession.connectedParticipantId,
                votingSession.topicId,
              ],
            })
            .returning(),
        );
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
        if (ids.length === 0) {
          return;
        }

        yield* use((database) =>
          database
            .update(votingSession)
            .set({ notificationLastSentAt })
            .where(inArray(votingSession.id, ids)),
        );
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
        const result = yield* use((database) =>
          database
            .select({ value: count() })
            .from(votingSession)
            .where(
              and(
                eq(votingSession.marathonId, marathonId),
                eq(votingSession.topicId, topicId),
              ),
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
        return yield* use((database) =>
          database.query.votingSession.findMany({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, marathonId),
                operators.eq(table.topicId, topicId),
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
            },
            orderBy: (table, operators) => operators.desc(table.createdAt),
          }),
        );
      });

      const createVotingRound = Effect.fn("VotingQueries.createVotingRound")(
        function* (roundData: NewVotingRound) {
          const [result] = yield* use((database) =>
            database
              .insert(votingRound)
              .values(roundData)
              .onConflictDoNothing({
                target: [votingRound.topicId, votingRound.roundNumber],
              })
              .returning(),
          );

          return result as VotingRound | undefined;
        },
      );

      const createVotingRoundSubmissions = Effect.fn(
        "VotingQueries.createVotingRoundSubmissions",
      )(function* ({
        roundId,
        submissionIds,
      }: {
        roundId: number;
        submissionIds: readonly number[];
      }) {
        if (submissionIds.length === 0) {
          return [];
        }

        const values: NewVotingRoundSubmission[] = submissionIds.map(
          (submissionId) => ({
            roundId,
            submissionId,
          }),
        );

        return yield* use((database) =>
          database
            .insert(votingRoundSubmission)
            .values(values)
            .onConflictDoNothing({
              target: [
                votingRoundSubmission.roundId,
                votingRoundSubmission.submissionId,
              ],
            })
            .returning(),
        );
      });

      const createVotingRoundVotes = Effect.fn(
        "VotingQueries.createVotingRoundVotes",
      )(function* ({ votes }: { votes: NewVotingRoundVote[] }) {
        if (votes.length === 0) {
          return [];
        }

        return yield* use((database) =>
          database.insert(votingRoundVote).values(votes).returning(),
        );
      });

      const getVotingRoundById = Effect.fn("VotingQueries.getVotingRoundById")(
        function* ({
          marathonId,
          topicId,
          roundId,
        }: {
          marathonId: number;
          topicId: number;
          roundId: number;
        }) {
          const result = yield* use((database) =>
            database.query.votingRound.findFirst({
              where: (table, operators) =>
                operators.and(
                  operators.eq(table.id, roundId),
                  operators.eq(table.marathonId, marathonId),
                  operators.eq(table.topicId, topicId),
                ),
            }),
          );

          return Option.fromNullishOr(result);
        },
      );

      const getLatestVotingRoundForTopic = Effect.fn(
        "VotingQueries.getLatestVotingRoundForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
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
        );

        return Option.fromNullishOr(result);
      });

      const getActiveVotingRoundForTopic = Effect.fn(
        "VotingQueries.getActiveVotingRoundForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
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
        );

        return Option.fromNullishOr(result);
      });

      const resolveRoundForTopic = Effect.fn(
        "VotingQueries.resolveRoundForTopic",
      )(function* ({ marathonId, topicId, roundId }: ResolveRoundInput) {
        if (roundId !== undefined && roundId !== null) {
          return yield* getVotingRoundById({
            marathonId,
            topicId,
            roundId,
          });
        }

        return yield* getLatestVotingRoundForTopic({
          marathonId,
          topicId,
        });
      });

      const getVotingSessionStatsForTopic = Effect.fn(
        "VotingQueries.getVotingSessionStatsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        const [sessionStatsResult, latestRoundOpt] = yield* Effect.all([
          use((database) =>
            database
              .select({
                total: sql<number>`count(*)`.as("total"),
                participantSessions:
                  sql<number>`count(${votingSession.connectedParticipantId})`.as(
                    "participant_sessions",
                  ),
                manualSessions:
                  sql<number>`count(*) - count(${votingSession.connectedParticipantId})`.as(
                    "manual_sessions",
                  ),
              })
              .from(votingSession)
              .where(
                and(
                  eq(votingSession.marathonId, marathonId),
                  eq(votingSession.topicId, topicId),
                ),
              ),
          ),
          getLatestVotingRoundForTopic({ marathonId, topicId }),
        ]);

        const latestRound = Option.getOrUndefined(latestRoundOpt);
        if (!latestRound) {
          const sessionStats = sessionStatsResult[0];
          return {
            total: sessionStats?.total ?? 0,
            completed: 0,
            participantSessions: sessionStats?.participantSessions ?? 0,
            manualSessions: sessionStats?.manualSessions ?? 0,
          };
        }

        const completedResult = yield* use((database) =>
          database
            .select({ value: count() })
            .from(votingRoundVote)
            .where(eq(votingRoundVote.roundId, latestRound.id)),
        );

        const sessionStats = sessionStatsResult[0];

        return {
          total: sessionStats?.total ?? 0,
          completed: completedResult[0]?.value ?? 0,
          participantSessions: sessionStats?.participantSessions ?? 0,
          manualSessions: sessionStats?.manualSessions ?? 0,
        };
      });

      const getVotingWindowForTopic = Effect.fn(
        "VotingQueries.getVotingWindowForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        const result = yield* use((database) =>
          database.query.topics.findFirst({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, marathonId),
                operators.eq(table.id, topicId),
              ),
            columns: {
              votingStartsAt: true,
              votingEndsAt: true,
            },
          }),
        );

        if (!result) {
          return undefined;
        }

        return {
          startsAt: result.votingStartsAt,
          endsAt: result.votingEndsAt,
        };
      });

      const upsertTopicVotingWindow = Effect.fn(
        "VotingQueries.upsertTopicVotingWindow",
      )(function* ({
        marathonId,
        topicId,
        startsAt,
        endsAt,
      }: {
        marathonId: number;
        topicId: number;
        startsAt: string;
        endsAt: string | null;
      }) {
        const result = yield* use((database) =>
          database
            .update(topics)
            .set({
              votingStartsAt: startsAt,
              votingEndsAt: endsAt,
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(eq(topics.marathonId, marathonId), eq(topics.id, topicId)),
            )
            .returning({
              startsAt: topics.votingStartsAt,
              endsAt: topics.votingEndsAt,
            }),
        );

        return result[0];
      });

      const updateVotingRoundWindow = Effect.fn(
        "VotingQueries.updateVotingRoundWindow",
      )(function* ({
        roundId,
        startedAt,
        endsAt,
        updatedAt,
      }: {
        roundId: number;
        startedAt?: string;
        endsAt: string | null;
        updatedAt: string;
      }) {
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
        );

        return result[0] as VotingRound | undefined;
      });

      const closeTopicVotingWindow = Effect.fn(
        "VotingQueries.closeTopicVotingWindow",
      )(function* ({
        marathonId,
        topicId,
        nowIso,
      }: {
        marathonId: number;
        topicId: number;
        nowIso: string;
      }) {
        const result = yield* use((database) =>
          database
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
            }),
        );

        return result[0];
      });

      const reopenTopicVotingWindow = Effect.fn(
        "VotingQueries.reopenTopicVotingWindow",
      )(function* ({
        marathonId,
        topicId,
        nowIso,
      }: {
        marathonId: number;
        topicId: number;
        nowIso: string;
      }) {
        const result = yield* use((database) =>
          database
            .update(topics)
            .set({
              votingEndsAt: null,
              updatedAt: nowIso,
            })
            .where(
              and(eq(topics.marathonId, marathonId), eq(topics.id, topicId)),
            )
            .returning({
              startsAt: topics.votingStartsAt,
              endsAt: topics.votingEndsAt,
            }),
        );

        return result[0];
      });

      const closeVotingWindowsForTopics = Effect.fn(
        "VotingQueries.closeVotingWindowsForTopics",
      )(function* ({
        marathonId,
        topicIds,
        nowIso,
      }: {
        marathonId: number;
        topicIds: readonly number[];
        nowIso: string;
      }) {
        if (topicIds.length === 0) {
          return [];
        }

        return yield* use((database) =>
          database
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
            }),
        );
      });

      const countSubmissionsForTopic = Effect.fn(
        "VotingQueries.countSubmissionsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        const result = yield* use((database) =>
          database
            .select({ value: count() })
            .from(submissions)
            .where(
              and(
                eq(submissions.marathonId, marathonId),
                eq(submissions.topicId, topicId),
              ),
            ),
        );

        return result[0]?.value ?? 0;
      });

      const countParticipantsWithSubmissionsForTopic = Effect.fn(
        "VotingQueries.countParticipantsWithSubmissionsForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        const result = yield* use((database) =>
          database
            .select({
              value:
                sql<number>`count(distinct ${submissions.participantId})`.as(
                  "value",
                ),
            })
            .from(submissions)
            .where(
              and(
                eq(submissions.marathonId, marathonId),
                eq(submissions.topicId, topicId),
              ),
            ),
        );

        return result[0]?.value ?? 0;
      });

      const countVotingRoundSubmissionsForTopic = Effect.fn(
        "VotingQueries.countVotingRoundSubmissionsForTopic",
      )(function* ({ marathonId, topicId, roundId }: ResolveRoundInput) {
        const roundOpt = yield* resolveRoundForTopic({
          marathonId,
          topicId,
          roundId,
        });

        const round = Option.getOrUndefined(roundOpt);
        if (!round) {
          return 0;
        }

        const result = yield* use((database) =>
          database
            .select({ value: count() })
            .from(votingRoundSubmission)
            .where(eq(votingRoundSubmission.roundId, round.id)),
        );

        return result[0]?.value ?? 0;
      });

      const getLeaderboardPageForTopic = Effect.fn(
        "VotingQueries.getLeaderboardPageForTopic",
      )(function* ({
        marathonId,
        topicId,
        page,
        limit,
        roundId,
      }: {
        marathonId: number;
        topicId: number;
        page: number;
        limit: number;
        roundId?: number | null;
      }) {
        const roundOpt = yield* resolveRoundForTopic({
          marathonId,
          topicId,
          roundId,
        });
        const round = Option.getOrUndefined(roundOpt);

        if (!round) {
          return [];
        }

        const offset = (page - 1) * limit;
        const rankedLeaderboard = buildRankedLeaderboard(round.id);

        return yield* use((database) =>
          database
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
            .offset(offset),
        );
      });

      const getTopRanksPreviewForTopic = Effect.fn(
        "VotingQueries.getTopRanksPreviewForTopic",
      )(function* ({ marathonId, topicId, roundId }: ResolveRoundInput) {
        const roundOpt = yield* resolveRoundForTopic({
          marathonId,
          topicId,
          roundId,
        });
        const round = Option.getOrUndefined(roundOpt);

        if (!round) {
          return [];
        }

        const rankedLeaderboard = buildRankedLeaderboard(round.id);
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
              order by ${rankedLeaderboard.submissionCreatedAt} asc, ${rankedLeaderboard.submissionId} asc
            )`.as("rank_entry_order"),
          })
          .from(rankedLeaderboard)
          .as("ranked_preview");

        return yield* use((database) =>
          database
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
            .orderBy(
              asc(rankedPreview.rank),
              asc(rankedPreview.rankEntryOrder),
            ),
        );
      });

      const getLeadingTieForTopic = Effect.fn(
        "VotingQueries.getLeadingTieForTopic",
      )(function* ({
        marathonId,
        topicId,
      }: {
        marathonId: number;
        topicId: number;
      }) {
        const roundOpt = yield* getLatestVotingRoundForTopic({
          marathonId,
          topicId,
        });
        const round = Option.getOrUndefined(roundOpt);

        if (!round) {
          return Option.none<{
            roundId: number;
            roundNumber: number;
            roundKind: string;
            voteCount: number;
            tieSize: number;
            submissionIds: number[];
          }>();
        }

        const rankedLeaderboard = buildRankedLeaderboard(round.id);
        const firstRankRows = yield* use((database) =>
          database
            .select({
              submissionId: rankedLeaderboard.submissionId,
              voteCount: rankedLeaderboard.voteCount,
              rank: rankedLeaderboard.rank,
              tieSize: rankedLeaderboard.tieSize,
            })
            .from(rankedLeaderboard)
            .where(sql`${rankedLeaderboard.rank} = 1`)
            .orderBy(
              asc(rankedLeaderboard.submissionCreatedAt),
              asc(rankedLeaderboard.submissionId),
            ),
        );

        const leadingRow = firstRankRows[0];
        if (!leadingRow || leadingRow.tieSize <= 1) {
          return Option.none();
        }

        return Option.some({
          roundId: round.id,
          roundNumber: round.roundNumber,
          roundKind: round.kind,
          voteCount: leadingRow.voteCount,
          tieSize: leadingRow.tieSize,
          submissionIds: firstRankRows.map((row) => row.submissionId),
        });
      });

      const getVotersPageForTopic = Effect.fn(
        "VotingQueries.getVotersPageForTopic",
      )(function* ({
        marathonId,
        topicId,
        page,
        limit,
        roundId,
      }: {
        marathonId: number;
        topicId: number;
        page: number;
        limit: number;
        roundId?: number | null;
      }) {
        const roundOpt = yield* resolveRoundForTopic({
          marathonId,
          topicId,
          roundId,
        });
        const round = Option.getOrUndefined(roundOpt);
        const offset = (page - 1) * limit;

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
                ? sql<number | null>`${votingRoundVote.submissionId}`.as(
                    "vote_submission_id",
                  )
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
            .leftJoin(
              submissions,
              eq(submissions.id, votingRoundVote.submissionId),
            )
            .leftJoin(
              participants,
              eq(participants.id, submissions.participantId),
            )
            .where(
              and(
                eq(votingSession.marathonId, marathonId),
                eq(votingSession.topicId, topicId),
              ),
            )
            .orderBy(desc(votingSession.createdAt), desc(votingSession.id))
            .limit(limit)
            .offset(offset),
        );
      });

      const getVotingSessionByIdForTopic = Effect.fn(
        "VotingQueries.getVotingSessionByIdForTopic",
      )(function* ({
        marathonId,
        topicId,
        sessionId,
      }: {
        marathonId: number;
        topicId: number;
        sessionId: number;
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
        );

        return Option.fromNullishOr(result);
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
        const marathonResult = yield* use((database) =>
          database.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
            columns: { id: true },
          }),
        );

        if (!marathonResult) {
          return Option.none<SubmissionVoteStatsRow>();
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
        );

        if (
          !submissionResult ||
          submissionResult.marathonId !== marathonResult.id
        ) {
          return Option.none<SubmissionVoteStatsRow>();
        }

        const roundOpt = yield* resolveRoundForTopic({
          marathonId: marathonResult.id,
          topicId: submissionResult.topicId,
        });
        const round = Option.getOrUndefined(roundOpt);

        if (!round) {
          return Option.some<SubmissionVoteStatsRow>({
            voteCount: 0,
            position: null,
            totalSubmissions: 0,
            roundId: null,
            roundNumber: null,
            roundKind: null,
          });
        }

        const totalSubmissions = yield* countVotingRoundSubmissionsForTopic({
          marathonId: marathonResult.id,
          topicId: submissionResult.topicId,
          roundId: round.id,
        });

        const rankedLeaderboard = buildRankedLeaderboard(round.id);
        const entryRow = yield* use((database) =>
          database
            .select({
              voteCount: rankedLeaderboard.voteCount,
              rank: rankedLeaderboard.rank,
            })
            .from(rankedLeaderboard)
            .where(eq(rankedLeaderboard.submissionId, submissionId))
            .limit(1),
        );

        const entry = entryRow[0];
        if (!entry) {
          return Option.some<SubmissionVoteStatsRow>({
            voteCount: 0,
            position: null,
            totalSubmissions,
            roundId: round.id,
            roundNumber: round.roundNumber,
            roundKind: round.kind,
          });
        }

        return Option.some<SubmissionVoteStatsRow>({
          voteCount: entry.voteCount,
          position: entry.rank,
          totalSubmissions,
          roundId: round.id,
          roundNumber: round.roundNumber,
          roundKind: round.kind,
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
        const votingSessionResult = yield* use((database) =>
          database.query.votingSession.findFirst({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.connectedParticipantId, participantId),
                operators.eq(table.topicId, topicId),
              ),
          }),
        );

        if (!votingSessionResult) {
          return Option.none();
        }

        const latestRoundOpt = yield* getLatestVotingRoundForTopic({
          marathonId: votingSessionResult.marathonId,
          topicId,
        });
        const latestRound = Option.getOrUndefined(latestRoundOpt);

        if (!latestRound) {
          const emptyVoteInfo: ParticipantVoteInfo = {
            hasVoted: false,
            votedAt: null,
            votedSubmissionId: null,
            votedTopicName: null,
            roundId: null,
            roundNumber: null,
            roundKind: null,
          };

          return Option.some(emptyVoteInfo);
        }

        const voteResult = yield* use((database) =>
          database
            .select({
              votedAt: votingRoundVote.votedAt,
              votedSubmissionId: votingRoundVote.submissionId,
              votedTopicName: topics.name,
            })
            .from(votingRoundVote)
            .innerJoin(
              submissions,
              eq(submissions.id, votingRoundVote.submissionId),
            )
            .innerJoin(topics, eq(topics.id, submissions.topicId))
            .where(
              and(
                eq(votingRoundVote.roundId, latestRound.id),
                eq(votingRoundVote.sessionId, votingSessionResult.id),
              ),
            )
            .limit(1),
        );

        const vote = voteResult[0];

        const participantVoteInfo: ParticipantVoteInfo = {
          hasVoted: !!vote,
          votedAt: vote?.votedAt ?? null,
          votedSubmissionId: vote?.votedSubmissionId ?? null,
          votedTopicName: vote?.votedTopicName ?? null,
          roundId: latestRound.id,
          roundNumber: latestRound.roundNumber,
          roundKind: latestRound.kind,
        };

        return Option.some(participantVoteInfo);
      });

      const getVotingSessionByParticipantId = Effect.fn(
        "VotingQueries.getVotingSessionByParticipantId",
      )(function* ({ participantId }: { participantId: number }) {
        const result = yield* use((database) =>
          database.query.votingSession.findFirst({
            where: (table, operators) =>
              operators.eq(table.connectedParticipantId, participantId),
            orderBy: (table, operators) => operators.desc(table.createdAt),
          }),
        );

        return Option.fromNullishOr(result);
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
        const result = yield* use((database) =>
          database.query.votingSession.findFirst({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.connectedParticipantId, participantId),
                operators.eq(table.topicId, topicId),
              ),
            orderBy: (table, operators) => operators.desc(table.createdAt),
          }),
        );

        return Option.fromNullishOr(result);
      });

      const getVotingRoundVoteForSession = Effect.fn(
        "VotingQueries.getVotingRoundVoteForSession",
      )(function* ({
        roundId,
        sessionId,
      }: {
        roundId: number;
        sessionId: number;
      }) {
        const result = yield* use((database) =>
          database.query.votingRoundVote.findFirst({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.roundId, roundId),
                operators.eq(table.sessionId, sessionId),
              ),
          }),
        );

        return Option.fromNullishOr(result);
      });

      const upsertVotingSession = Effect.fn(
        "VotingQueries.upsertVotingSession",
      )(function* (sessionData: NewVotingSession) {
        const result = yield* use((database) =>
          database
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
            .returning(),
        );

        return result[0] as VotingSession;
      });

      const getSubmissionsForVoting = Effect.fn(
        "VotingQueries.getSubmissionsForVoting",
      )(function* ({ marathonId, topicId, roundId }: ResolveRoundInput) {
        const roundOpt = yield* resolveRoundForTopic({
          marathonId,
          topicId,
          roundId,
        });
        const round = Option.getOrUndefined(roundOpt);

        if (!round) {
          return [];
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
            .innerJoin(
              submissions,
              eq(submissions.id, votingRoundSubmission.submissionId),
            )
            .innerJoin(
              participants,
              eq(participants.id, submissions.participantId),
            )
            .innerJoin(topics, eq(topics.id, submissions.topicId))
            .where(eq(votingRoundSubmission.roundId, round.id))
            .orderBy(asc(submissions.id)),
        );
      });

      const recordVote = Effect.fn("VotingQueries.recordVote")(function* ({
        roundId,
        sessionId,
        submissionId,
      }: {
        roundId: number;
        sessionId: number;
        submissionId: number;
      }) {
        const now = new Date().toISOString();
        const values: NewVotingRoundVote = {
          roundId,
          sessionId,
          submissionId,
          votedAt: now,
        };

        const result = yield* use((database) =>
          database.insert(votingRoundVote).values(values).returning(),
        );

        return result[0];
      });

      const clearVote = Effect.fn("VotingQueries.clearVote")(function* ({
        roundId,
        sessionId,
      }: {
        roundId: number;
        sessionId: number;
      }) {
        const result = yield* use((database) =>
          database
            .delete(votingRoundVote)
            .where(
              and(
                eq(votingRoundVote.roundId, roundId),
                eq(votingRoundVote.sessionId, sessionId),
              ),
            )
            .returning(),
        );

        return result[0];
      });

      const deleteVotingSession = Effect.fn(
        "VotingQueries.deleteVotingSession",
      )(function* ({ sessionId }: { sessionId: number }) {
        const result = yield* use((database) =>
          database
            .delete(votingSession)
            .where(eq(votingSession.id, sessionId))
            .returning(),
        );

        return result[0] as VotingSession | undefined;
      });

      return {
        getVotingSessionByToken,
        getVotingSessionsByIdsWithMarathon,
        getPublicMarathonByDomain,
        getParticipantsWithSubmissionsByTopicId,
        getParticipantsWithSubmissionsButNoVotingSession,
        createVotingSessions,
        updateMultipleLastNotificationSentAt,
        countVotingSessionsForTopic,
        getVotingSessionsForTopic,
        createVotingRound,
        createVotingRoundSubmissions,
        createVotingRoundVotes,
        getVotingRoundById,
        getLatestVotingRoundForTopic,
        getActiveVotingRoundForTopic,
        getVotingSessionStatsForTopic,
        getVotingWindowForTopic,
        upsertTopicVotingWindow,
        updateVotingRoundWindow,
        closeTopicVotingWindow,
        reopenTopicVotingWindow,
        closeVotingWindowsForTopics,
        countSubmissionsForTopic,
        countParticipantsWithSubmissionsForTopic,
        countVotingRoundSubmissionsForTopic,
        getLeaderboardPageForTopic,
        getTopRanksPreviewForTopic,
        getLeadingTieForTopic,
        getVotersPageForTopic,
        getVotingSessionByIdForTopic,
        getSubmissionVoteStats,
        getParticipantVoteInfo,
        getVotingSessionByParticipantId,
        getVotingSessionByParticipantAndTopicId,
        getVotingRoundVoteForSession,
        upsertVotingSession,
        getSubmissionsForVoting,
        recordVote,
        clearVote,
        deleteVotingSession,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
