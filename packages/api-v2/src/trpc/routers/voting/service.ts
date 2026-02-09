import "server-only";

import { Effect, Option, Config } from "effect";
import {
  Database,
  type VotingSession,
  type NewVotingSession,
} from "@blikka/db";
import { VotingApiError } from "./schemas";
import { SMSService } from "@blikka/sms";
import {
  PhoneNumberEncryptionService,
  type EncryptedPhoneNumber,
} from "../../utils/phone-number-encryption";
import { randomBytes } from "crypto";

const AWS_S3_BASE_URL = "https://s3.eu-north-1.amazonaws.com";

function buildS3Url(
  bucketName: string,
  key: string | null | undefined,
): string | undefined {
  if (!key) return undefined;
  return `${AWS_S3_BASE_URL}/${bucketName}/${key}`;
}

function parseVotingWindow({
  startsAt,
  endsAt,
}: {
  startsAt: string;
  endsAt: string;
}): Effect.Effect<{ startsAtIso: string; endsAtIso: string }, VotingApiError> {
  return Effect.gen(function* () {
    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(endsAt);

    if (Number.isNaN(startsAtDate.getTime())) {
      return yield* Effect.fail(
        new VotingApiError({
          message: "Invalid startsAt timestamp",
        }),
      );
    }

    if (Number.isNaN(endsAtDate.getTime())) {
      return yield* Effect.fail(
        new VotingApiError({
          message: "Invalid endsAt timestamp",
        }),
      );
    }

    if (startsAtDate >= endsAtDate) {
      return yield* Effect.fail(
        new VotingApiError({
          message: "startsAt must be before endsAt",
        }),
      );
    }

    return {
      startsAtIso: startsAtDate.toISOString(),
      endsAtIso: endsAtDate.toISOString(),
    };
  });
}

function ensureSessionDomain(
  votingSession: VotingSession & { marathon?: { domain: string } | null },
  domain: string,
): Effect.Effect<void, VotingApiError> {
  if (
    votingSession.marathon?.domain &&
    votingSession.marathon.domain !== domain
  ) {
    return Effect.fail(
      new VotingApiError({
        message: "Voting session not found",
      }),
    );
  }

  return Effect.void;
}

function ensureVotingSessionWindow(
  votingSession: Pick<VotingSession, "startsAt" | "endsAt">,
): Effect.Effect<void, VotingApiError> {
  const now = new Date();

  if (votingSession.startsAt) {
    const startsAt = new Date(votingSession.startsAt);
    if (startsAt > now) {
      return Effect.fail(
        new VotingApiError({
          message: "Voting session has not started yet",
        }),
      );
    }
  }

  if (votingSession.endsAt) {
    const endsAt = new Date(votingSession.endsAt);
    if (endsAt < now) {
      return Effect.fail(
        new VotingApiError({
          message: "Voting session has expired",
        }),
      );
    }
  }

  return Effect.void;
}

export class VotingApiService extends Effect.Service<VotingApiService>()(
  "@blikka/api-v2/VotingApiService",
  {
    accessors: true,
    dependencies: [
      Database.Default,
      SMSService.Default,
      PhoneNumberEncryptionService.layer,
    ],
    effect: Effect.gen(function* () {
      const db = yield* Database;
      const smsService = yield* SMSService;
      const phoneEncryption = yield* PhoneNumberEncryptionService;

      const submissionsBucketName = yield* Config.string(
        "SUBMISSIONS_BUCKET_NAME",
      );
      const thumbnailsBucketName = yield* Config.string(
        "THUMBNAILS_BUCKET_NAME",
      );

      const generateUniqueToken = Effect.fn(
        "VotingApiService.generateUniqueToken",
      )(function* ({
        usedTokens = new Set<string>(),
      }: { usedTokens?: Set<string> } = {}) {
        while (true) {
          const token = randomBytes(8).toString("base64url").slice(0, 8);
          if (usedTokens.has(token)) {
            continue;
          }
          const existing = yield* db.votingQueries.getVotingSessionByToken({
            token,
          });
          if (Option.isNone(existing)) {
            usedTokens.add(token);
            return token;
          }
        }
      });

      const getVotingSession = Effect.fn("VotingApiService.getVotingSession")(
        function* ({ token, domain }: { token: string; domain: string }) {
          const votingSessionResult =
            yield* db.votingQueries.getVotingSessionByToken({ token });

          const votingSession = yield* Option.match(votingSessionResult, {
            onSome: (session) => Effect.succeed(session),
            onNone: () =>
              Effect.fail(
                new VotingApiError({
                  message: "Voting session not found",
                }),
              ),
          });

          yield* ensureSessionDomain(votingSession, domain);
          yield* ensureVotingSessionWindow(votingSession);

          return votingSession;
        },
      );

      const startVotingSessions = Effect.fn(
        "VotingApiService.startVotingSessions",
      )(function* ({
        domain,
        topicId,
        startsAt,
        endsAt,
      }: {
        domain: string;
        topicId: number;
        startsAt: string;
        endsAt: string;
      }) {
        const { startsAtIso, endsAtIso } = yield* parseVotingWindow({
          startsAt,
          endsAt,
        });

        const marathonOpt =
          yield* db.marathonsQueries.getMarathonByDomainWithOptions({
            domain,
          });

        const marathon = yield* Option.match(marathonOpt, {
          onSome: (m) => Effect.succeed(m),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            ),
        });

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new VotingApiError({
              message: `Marathon '${marathon.domain}' is not in by-camera mode`,
            }),
          );
        }

        const activeTopic = marathon.topics.find(
          (topic) => topic.visibility === "active",
        );
        if (!activeTopic || activeTopic.id !== topicId) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "Voting can only be started for the active by-camera topic",
            }),
          );
        }

        const existingCount =
          yield* db.votingQueries.countVotingSessionsForTopic({
            marathonId: marathon.id,
            topicId,
          });

        if (existingCount > 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Voting sessions already exist for this topic",
            }),
          );
        }

        const participantsWithSubmissions =
          yield* db.votingQueries.getParticipantsWithSubmissionsByTopicId({
            marathonId: marathon.id,
            topicId,
          });

        if (participantsWithSubmissions.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "No participants with submissions found for this topic",
            }),
          );
        }

        const usedTokens = new Set<string>();
        const sessionsToCreate: NewVotingSession[] = yield* Effect.forEach(
          participantsWithSubmissions,
          (participant) =>
            Effect.gen(function* () {
              const token = yield* generateUniqueToken({ usedTokens });

              return {
                token,
                firstName: participant.firstname,
                lastName: participant.lastname,
                email: participant.email ?? "",
                phoneHash: participant.phoneHash,
                phoneEncrypted: participant.phoneEncrypted,
                marathonId: marathon.id,
                startsAt: startsAtIso,
                endsAt: endsAtIso,
                voteSubmissionId: null,
                connectedParticipantId: participant.id,
                notificationLastSentAt: null,
                topicId,
              } satisfies NewVotingSession;
            }),
          { concurrency: 1 },
        );

        const createdSessions = yield* db.votingQueries.createVotingSessions({
          sessions: sessionsToCreate,
        });

        const smsResults = yield* Effect.all(
          createdSessions
            .filter((session) => session.phoneEncrypted)
            .map((session) =>
              Effect.gen(function* () {
                const phoneNumber = yield* phoneEncryption.decrypt({
                  encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
                });

                const message = `Voting is starting for ${marathon.name}! Vote here: https://${domain}.blikka.app/live/vote/${session.token}`;

                const result = yield* smsService.sendWithOptOutCheck({
                  phoneNumber,
                  message,
                });

                return {
                  sessionId: session.id,
                  phoneNumber,
                  smsResult: result,
                };
              }).pipe(
                Effect.catchAll((error) =>
                  Effect.succeed({
                    sessionId: session.id,
                    phoneNumber: null,
                    error: String(error),
                  }),
                ),
              ),
            ),
          { concurrency: 5 },
        );

        yield* db.votingQueries.updateMultipleLastNotificationSentAt({
          ids: createdSessions.map((session) => session.id),
          notificationLastSentAt: new Date().toISOString(),
        });

        return {
          topicId,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          sessionsCreated: createdSessions.length,
          smsSent: smsResults.filter((result) => !("error" in result)).length,
          smsResults,
        };
      });

      const getSubmissionVoteStats = Effect.fn(
        "VotingApiService.getSubmissionVoteStats",
      )(function* ({
        submissionId,
        domain,
      }: {
        submissionId: number;
        domain: string;
      }) {
        const statsResult = yield* db.votingQueries.getSubmissionVoteStats({
          submissionId,
          domain,
        });

        const stats = yield* Option.match(statsResult, {
          onSome: (s) => Effect.succeed(s),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Failed to get vote stats",
              }),
            ),
        });

        const submission = yield* db.submissionsQueries.getSubmissionById({
          id: submissionId,
        });

        let participantVoteInfo = null;
        if (Option.isSome(submission)) {
          const participantId = submission.value.participantId;
          const voteInfoResult = yield* db.votingQueries.getParticipantVoteInfo(
            {
              participantId,
              topicId: submission.value.topicId,
            },
          );

          if (Option.isSome(voteInfoResult)) {
            participantVoteInfo = voteInfoResult.value;
          }
        }

        return {
          ...stats,
          participantVoteInfo,
        };
      });

      const createOrUpdateVotingSessionForParticipant = Effect.fn(
        "VotingApiService.createOrUpdateVotingSessionForParticipant",
      )(function* ({
        participantId,
        domain,
        topicId,
      }: {
        participantId: number;
        domain: string;
        topicId: number;
      }) {
        const marathonOpt =
          yield* db.marathonsQueries.getMarathonByDomainWithOptions({
            domain,
          });

        const marathon = yield* Option.match(marathonOpt, {
          onSome: (m) => Effect.succeed(m),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            ),
        });

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new VotingApiError({
              message: `Marathon '${marathon.domain}' is not in by-camera mode`,
            }),
          );
        }

        const participantOpt = yield* db.participantsQueries.getParticipantById(
          {
            id: participantId,
          },
        );

        const participant = yield* Option.match(participantOpt, {
          onSome: (p) => Effect.succeed(p),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Participant not found with id ${participantId}`,
              }),
            ),
        });

        const submissions =
          yield* db.submissionsQueries.getSubmissionsByParticipantId({
            participantId,
          });

        if (!submissions.some((submission) => submission.topicId === topicId)) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Participant has no submissions for this topic",
            }),
          );
        }

        const existingSessionOpt =
          yield* db.votingQueries.getVotingSessionByParticipantAndTopicId({
            participantId,
            topicId,
          });

        if (Option.isSome(existingSessionOpt)) {
          const existingSession = existingSessionOpt.value;
          if (existingSession.votedAt) {
            return {
              action: "already_voted" as const,
              session: existingSession,
            };
          }
        }

        const now = new Date();
        const defaultEndsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const sessionData: NewVotingSession = {
          token: yield* generateUniqueToken(),
          firstName: participant.firstname,
          lastName: participant.lastname,
          email: participant.email ?? "",
          phoneHash: participant.phoneHash,
          phoneEncrypted: participant.phoneEncrypted,
          marathonId: marathon.id,
          startsAt: now.toISOString(),
          endsAt: defaultEndsAt.toISOString(),
          voteSubmissionId: null,
          connectedParticipantId: participantId,
          notificationLastSentAt: now.toISOString(),
          topicId,
        };

        const session =
          yield* db.votingQueries.upsertVotingSession(sessionData);

        let smsResult = null;
        if (session.phoneEncrypted) {
          const smsResult_ = yield* Effect.gen(function* () {
            const phoneNumber = yield* phoneEncryption.decrypt({
              encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
            });

            const message = `Voting is starting for ${marathon.name}! Vote here: https://${domain}.blikka.app/live/vote/${session.token}`;

            const result = yield* smsService.sendWithOptOutCheck({
              phoneNumber,
              message,
            });

            return {
              phoneNumber,
              smsResult: result,
            };
          }).pipe(
            Effect.catchAll((error) =>
              Effect.succeed({
                phoneNumber: null,
                error: String(error),
              }),
            ),
          );
          smsResult = smsResult_;
        }

        const action = Option.isSome(existingSessionOpt) ? "resent" : "created";

        return {
          action,
          session,
          smsSent: smsResult && !("error" in smsResult),
          smsError: smsResult && "error" in smsResult ? smsResult.error : null,
        };
      });

      const getVotingSessionByParticipant = Effect.fn(
        "VotingApiService.getVotingSessionByParticipant",
      )(function* ({
        participantId,
        topicId,
      }: {
        participantId: number;
        topicId: number;
      }) {
        const sessionOpt =
          yield* db.votingQueries.getVotingSessionByParticipantAndTopicId({
            participantId,
            topicId,
          });

        return Option.match(sessionOpt, {
          onSome: (session) => ({
            hasSession: true as const,
            session,
            hasVoted: session.votedAt !== null,
            notificationLastSentAt: session.notificationLastSentAt,
          }),
          onNone: () => ({
            hasSession: false as const,
          }),
        });
      });

      const getVotingAdminOverview = Effect.fn(
        "VotingApiService.getVotingAdminOverview",
      )(function* ({ domain, topicId }: { domain: string; topicId: number }) {
        const marathonOpt =
          yield* db.marathonsQueries.getMarathonByDomainWithOptions({
            domain,
          });

        const marathon = yield* Option.match(marathonOpt, {
          onSome: (m) => Effect.succeed(m),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            ),
        });

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new VotingApiError({
              message: `Marathon '${marathon.domain}' is not in by-camera mode`,
            }),
          );
        }

        const topic = marathon.topics.find((item) => item.id === topicId);
        if (!topic) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Topic not found",
            }),
          );
        }

        const sessions = yield* db.votingQueries.getVotingSessionsForTopic({
          marathonId: marathon.id,
          topicId,
        });

        const leaderboardRows =
          yield* db.votingQueries.getSubmissionVoteLeaderboardForTopic({
            marathonId: marathon.id,
            topicId,
          });

        const voteCountByValue = leaderboardRows.reduce((acc, row) => {
          acc.set(row.voteCount, (acc.get(row.voteCount) ?? 0) + 1);
          return acc;
        }, new Map<number, number>());

        let currentRank = 0;
        let previousVoteCount: number | null = null;

        const rankedLeaderboard = leaderboardRows.map((row, index) => {
          if (
            previousVoteCount === null ||
            row.voteCount !== previousVoteCount
          ) {
            currentRank = index + 1;
            previousVoteCount = row.voteCount;
          }

          const tieSize = voteCountByValue.get(row.voteCount) ?? 1;

          return {
            rank: currentRank,
            submissionId: row.submissionId,
            submissionCreatedAt: row.submissionCreatedAt,
            submissionKey: row.submissionKey,
            submissionThumbnailKey: row.submissionThumbnailKey,
            participantId: row.participantId,
            participantFirstName: row.participantFirstName,
            participantLastName: row.participantLastName,
            participantReference: row.participantReference,
            voteCount: row.voteCount,
            isTie: tieSize > 1,
            tieSize,
          };
        });

        const tieGroups = Array.from(voteCountByValue.entries())
          .filter(([, size]) => size > 1)
          .map(([voteCount]) => {
            const rowsForVoteCount = rankedLeaderboard.filter(
              (entry) => entry.voteCount === voteCount,
            );

            return {
              voteCount,
              rank: rowsForVoteCount[0]?.rank ?? 0,
              submissionIds: rowsForVoteCount.map(
                (entry) => entry.submissionId,
              ),
            };
          })
          .sort((a, b) => a.rank - b.rank);

        const topRanks = Array.from(
          rankedLeaderboard.reduce((acc, row) => {
            if (!acc.has(row.rank)) {
              acc.set(row.rank, [] as typeof rankedLeaderboard);
            }
            acc.get(row.rank)!.push(row);
            return acc;
          }, new Map<number, Array<(typeof rankedLeaderboard)[number]>>()),
        )
          .sort(([rankA], [rankB]) => rankA - rankB)
          .slice(0, 3)
          .map(([rank, entries]) => ({
            rank,
            entries,
          }));

        const completedSessions = sessions.filter(
          (session) => session.votedAt !== null,
        );
        const manualSessions = sessions.filter(
          (session) => session.connectedParticipantId === null,
        );
        const voters = yield* Effect.forEach(
          sessions,
          (session) =>
            Effect.gen(function* () {
              const phoneNumber = session.phoneEncrypted
                ? yield* phoneEncryption
                    .decrypt({
                      encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
                    })
                    .pipe(Effect.catchAll(() => Effect.succeed(null)))
                : null;

              return {
                sessionId: session.id,
                firstName: session.firstName,
                lastName: session.lastName,
                email: session.email,
                token: session.token,
                phoneNumber,
                notificationLastSentAt: session.notificationLastSentAt,
                connectedParticipantId: session.connectedParticipantId,
                votedAt: session.votedAt,
              };
            }),
          { concurrency: 5 },
        );

        return {
          topic: {
            id: topic.id,
            name: topic.name,
            orderIndex: topic.orderIndex,
            activatedAt: topic.activatedAt,
          },
          votingWindow: {
            startsAt: sessions[0]?.startsAt ?? null,
            endsAt: sessions[0]?.endsAt ?? null,
          },
          sessionStats: {
            total: sessions.length,
            completed: completedSessions.length,
            pending: sessions.length - completedSessions.length,
            participantSessions: sessions.length - manualSessions.length,
            manualSessions: manualSessions.length,
          },
          voteStats: {
            totalVotes: completedSessions.length,
          },
          topRanks,
          tieGroups,
          leaderboard: rankedLeaderboard,
          voters,
        };
      });

      const createManualVotingSession = Effect.fn(
        "VotingApiService.createManualVotingSession",
      )(function* ({
        domain,
        topicId,
        firstName,
        lastName,
        email,
        startsAt,
        endsAt,
      }: {
        domain: string;
        topicId: number;
        firstName: string;
        lastName: string;
        email: string;
        startsAt: string;
        endsAt: string;
      }) {
        const parsedFirstName = firstName.trim();
        const parsedLastName = lastName.trim();
        const parsedEmail = email.trim();

        if (!parsedFirstName || !parsedLastName || !parsedEmail) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "First name, last name and email are required",
            }),
          );
        }

        const { startsAtIso, endsAtIso } = yield* parseVotingWindow({
          startsAt,
          endsAt,
        });

        const marathonOpt =
          yield* db.marathonsQueries.getMarathonByDomainWithOptions({
            domain,
          });

        const marathon = yield* Option.match(marathonOpt, {
          onSome: (m) => Effect.succeed(m),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            ),
        });

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new VotingApiError({
              message: `Marathon '${marathon.domain}' is not in by-camera mode`,
            }),
          );
        }

        const activeTopic = marathon.topics.find(
          (topic) => topic.visibility === "active",
        );
        if (!activeTopic || activeTopic.id !== topicId) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "Manual invites are only allowed on the active by-camera topic",
            }),
          );
        }

        const created = yield* db.votingQueries.createVotingSessions({
          sessions: [
            {
              token: yield* generateUniqueToken(),
              firstName: parsedFirstName,
              lastName: parsedLastName,
              email: parsedEmail,
              phoneHash: null,
              phoneEncrypted: null,
              marathonId: marathon.id,
              startsAt: startsAtIso,
              endsAt: endsAtIso,
              voteSubmissionId: null,
              connectedParticipantId: null,
              notificationLastSentAt: null,
              topicId,
            },
          ],
        });

        const createdSession = created[0];
        if (!createdSession) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to create manual voting session",
            }),
          );
        }

        return {
          session: createdSession,
          votingUrl: `https://${domain}.blikka.app/live/vote/${createdSession.token}`,
        };
      });

      const resendVotingSessionNotification = Effect.fn(
        "VotingApiService.resendVotingSessionNotification",
      )(function* ({
        domain,
        topicId,
        sessionId,
      }: {
        domain: string;
        topicId: number;
        sessionId: number;
      }) {
        const marathonOpt =
          yield* db.marathonsQueries.getMarathonByDomainWithOptions({
            domain,
          });

        const marathon = yield* Option.match(marathonOpt, {
          onSome: (m) => Effect.succeed(m),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            ),
        });

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new VotingApiError({
              message: `Marathon '${marathon.domain}' is not in by-camera mode`,
            }),
          );
        }

        const topic = marathon.topics.find((item) => item.id === topicId);
        if (!topic) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Topic not found",
            }),
          );
        }

        const sessions = yield* db.votingQueries.getVotingSessionsForTopic({
          marathonId: marathon.id,
          topicId,
        });

        const session = sessions.find((item) => item.id === sessionId);
        if (!session) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Voting session not found for the selected topic",
            }),
          );
        }

        if (!session.phoneEncrypted) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "This voter has no phone number, so SMS notification cannot be sent",
            }),
          );
        }

        const phoneNumber = yield* phoneEncryption
          .decrypt({
            encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
          })
          .pipe(
            Effect.mapError(
              () =>
                new VotingApiError({
                  message: "Failed to decrypt phone number for this voter",
                }),
            ),
          );

        yield* smsService
          .sendWithOptOutCheck({
            phoneNumber,
            message: `Voting is starting for ${marathon.name}! Vote here: https://${domain}.blikka.app/live/vote/${session.token}`,
          })
          .pipe(
            Effect.mapError(
              (error) =>
                new VotingApiError({
                  message:
                    error instanceof Error
                      ? error.message
                      : "Failed to send voting notification to this voter",
                  cause: error,
                }),
            ),
          );

        const notificationLastSentAt = new Date().toISOString();
        yield* db.votingQueries.updateMultipleLastNotificationSentAt({
          ids: [session.id],
          notificationLastSentAt,
        });

        return {
          sessionId: session.id,
          notificationLastSentAt,
        };
      });

      const getVotingSubmissions = Effect.fn(
        "VotingApiService.getVotingSubmissions",
      )(function* ({ token, domain }: { token: string; domain: string }) {
        const votingSessionResult =
          yield* db.votingQueries.getVotingSessionByToken({ token });

        const votingSession = yield* Option.match(votingSessionResult, {
          onSome: (session) => Effect.succeed(session),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found",
              }),
            ),
        });

        yield* ensureSessionDomain(votingSession, domain);

        if (votingSession.votedAt && votingSession.voteSubmissionId) {
          return {
            alreadyVoted: true,
            votedAt: votingSession.votedAt,
            votedSubmissionId: votingSession.voteSubmissionId,
            submissions: [],
            sessionInfo: {
              token: votingSession.token,
              firstName: votingSession.firstName,
              lastName: votingSession.lastName,
              email: votingSession.email,
              startsAt: votingSession.startsAt,
              endsAt: votingSession.endsAt,
            },
          };
        }

        yield* ensureVotingSessionWindow(votingSession);

        const submissions = yield* db.votingQueries.getSubmissionsForVoting({
          marathonId: votingSession.marathonId,
          topicId: votingSession.topicId,
        });

        const votingSubmissions = submissions
          .filter((submission) => submission.key)
          .map((submission) => ({
            submissionId: submission.id,
            participantId: submission.participantId,
            url: buildS3Url(submissionsBucketName, submission.key),
            thumbnailUrl: buildS3Url(
              thumbnailsBucketName,
              submission.thumbnailKey,
            ),
            previewUrl: buildS3Url(
              submissionsBucketName,
              submission.previewKey,
            ),
            topicId: submission.topicId,
            topicName: submission.topic?.name ?? "",
          }));

        return {
          alreadyVoted: false,
          votedAt: votingSession.votedAt,
          votedSubmissionId: votingSession.voteSubmissionId,
          submissions: votingSubmissions,
          sessionInfo: {
            token: votingSession.token,
            firstName: votingSession.firstName,
            lastName: votingSession.lastName,
            email: votingSession.email,
            startsAt: votingSession.startsAt,
            endsAt: votingSession.endsAt,
          },
        };
      });

      const submitVote = Effect.fn("VotingApiService.submitVote")(function* ({
        token,
        submissionId,
        domain,
      }: {
        token: string;
        submissionId: number;
        domain: string;
      }) {
        const votingSessionResult =
          yield* db.votingQueries.getVotingSessionByToken({ token });

        const votingSession = yield* Option.match(votingSessionResult, {
          onSome: (session) => Effect.succeed(session),
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Voting session not found",
              }),
            ),
        });

        yield* ensureSessionDomain(votingSession, domain);

        if (votingSession.votedAt) {
          return {
            success: false as const,
            error: "already_voted" as const,
            votedAt: votingSession.votedAt,
          };
        }

        yield* ensureVotingSessionWindow(votingSession);

        const submission = yield* db.submissionsQueries.getSubmissionById({
          id: submissionId,
        });

        yield* Option.match(submission, {
          onSome: (resolvedSubmission) => {
            if (resolvedSubmission.marathonId !== votingSession.marathonId) {
              return Effect.fail(
                new VotingApiError({
                  message: "Submission does not belong to this marathon",
                }),
              );
            }

            if (resolvedSubmission.topicId !== votingSession.topicId) {
              return Effect.fail(
                new VotingApiError({
                  message: "Submission does not belong to this voting topic",
                }),
              );
            }

            return Effect.void;
          },
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Submission not found",
              }),
            ),
        });

        const updatedSession = yield* db.votingQueries.recordVote({
          token,
          submissionId,
        });

        if (!updatedSession) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Failed to record vote",
            }),
          );
        }

        return {
          success: true as const,
          votedAt: updatedSession.votedAt,
          submissionId: updatedSession.voteSubmissionId,
        };
      });

      return {
        getVotingSession,
        startVotingSessions,
        getSubmissionVoteStats,
        createOrUpdateVotingSessionForParticipant,
        getVotingSessionByParticipant,
        getVotingAdminOverview,
        createManualVotingSession,
        resendVotingSessionNotification,
        getVotingSubmissions,
        submitVote,
      } as const;
    }),
  },
) {}
