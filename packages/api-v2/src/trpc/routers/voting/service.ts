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

// S3 URL builder - matches web-v2/src/lib/utils.ts
const AWS_S3_BASE_URL = "https://s3.eu-north-1.amazonaws.com";
function buildS3Url(
  bucketName: string,
  key: string | null | undefined,
): string | undefined {
  if (!key) return undefined;
  return `${AWS_S3_BASE_URL}/${bucketName}/${key}`;
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

          if (votingSession.endsAt) {
            const now = new Date();
            const endsAt = new Date(votingSession.endsAt);
            if (endsAt < now) {
              return yield* Effect.fail(
                new VotingApiError({
                  message: "Voting session has expired",
                }),
              );
            }
          }


          return votingSession
        },
      );

      const startVotingSessions = Effect.fn(
        "VotingApiService.startVotingSessions",
      )(function* ({ domain }: { domain: string }) {
        const marathonOpt = yield* db.marathonsQueries.getMarathonByDomain({
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

        const participants =
          yield* db.votingQueries.getParticipantsWithSubmissionsByMarathonId({
            marathonId: marathon.id,
          });

        console.log("participants", participants);

        const participantsWithSubmissions = participants.filter(
          (p) => p.submissions.length > 0,
        );

        if (participantsWithSubmissions.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message:
                "No participants with submissions found for this marathon",
            }),
          );
        }

        const token = randomBytes(8).toString("base64url").slice(0, 8);

        const sessionsToCreate: NewVotingSession[] =
          participantsWithSubmissions.map((p) => ({
            token,
            firstName: p.firstname,
            lastName: p.lastname,
            email: p.email ?? "",
            phoneHash: p.phoneHash,
            phoneEncrypted: p.phoneEncrypted,
            marathonId: marathon.id,
            voteSubmissionId: null,
            connectedParticipantId: p.id,
            notificationLastSentAt: null,
          }));

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
          sessionsCreated: createdSessions.length,
          smsSent: smsResults.filter((r) => !("error" in r)).length,
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
        // Get vote stats
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

        // Get participant vote info if submission has a participant
        const submission = yield* db.submissionsQueries.getSubmissionById({
          id: submissionId,
        });

        let participantVoteInfo = null;
        if (Option.isSome(submission)) {
          const participantId = submission.value.participantId;
          const voteInfoResult = yield* db.votingQueries.getParticipantVoteInfo(
            {
              participantId,
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
      }: {
        participantId: number;
        domain: string;
      }) {
        // Get marathon
        const marathonOpt = yield* db.marathonsQueries.getMarathonByDomain({
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

        // Get participant with submissions
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

        // Check if participant has submissions
        const submissions =
          yield* db.submissionsQueries.getSubmissionsByParticipantId({
            participantId,
          });

        if (submissions.length === 0) {
          return yield* Effect.fail(
            new VotingApiError({
              message: "Participant has no submissions",
            }),
          );
        }

        // Check for existing voting session
        const existingSessionOpt =
          yield* db.votingQueries.getVotingSessionByParticipantId({
            participantId,
          });

        // If session exists and participant has voted, return error
        if (Option.isSome(existingSessionOpt)) {
          const existingSession = existingSessionOpt.value;
          if (existingSession.votedAt) {
            return {
              action: "already_voted" as const,
              session: existingSession,
            };
          }
        }

        const token = randomBytes(8).toString("base64url").slice(0, 8);
        const now = new Date().toISOString();

        // Create or update voting session
        const sessionData = {
          token,
          firstName: participant.firstname,
          lastName: participant.lastname,
          email: participant.email ?? "",
          phoneHash: participant.phoneHash,
          phoneEncrypted: participant.phoneEncrypted,
          marathonId: marathon.id,
          voteSubmissionId: null,
          connectedParticipantId: participantId,
          notificationLastSentAt: now,
        };

        const session =
          yield* db.votingQueries.upsertVotingSession(sessionData);

        // Send SMS if phone is available
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
      )(function* ({ participantId }: { participantId: number }) {
        const sessionOpt =
          yield* db.votingQueries.getVotingSessionByParticipantId({
            participantId,
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

        if (votingSession.endsAt) {
          const now = new Date();
          const endsAt = new Date(votingSession.endsAt);
          if (endsAt < now) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "Voting session has expired",
              }),
            );
          }
        }


        // Get all submissions for the marathon
        const submissions = yield* db.votingQueries.getSubmissionsForVoting({
          marathonId: votingSession.marathonId,
        });

        const votingSubmissions = submissions
          .filter((s) => s.key)
          .map((s) => ({
            submissionId: s.id,
            participantId: s.participantId,
            url: buildS3Url(submissionsBucketName, s.key),
            thumbnailUrl: buildS3Url(thumbnailsBucketName, s.thumbnailKey),
            previewUrl: buildS3Url(submissionsBucketName, s.previewKey),
            topicId: s.topicId,
            topicName: s.topic?.name ?? "",
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
        // Validate voting session exists and hasn't expired
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

        // Check if already voted
        if (votingSession.votedAt) {
          return {
            success: false as const,
            error: "already_voted" as const,
            votedAt: votingSession.votedAt,
          };
        }

        // Check session hasn't expired
        if (votingSession.endsAt) {
          const now = new Date();
          const endsAt = new Date(votingSession.endsAt);
          if (endsAt < now) {
            return yield* Effect.fail(
              new VotingApiError({
                message: "Voting session has expired",
              }),
            );
          }
        }

        // Validate the submission exists and belongs to the same marathon
        const submission = yield* db.submissionsQueries.getSubmissionById({
          id: submissionId,
        });

        const validSubmission = yield* Option.match(submission, {
          onSome: (s) => {
            if (s.marathonId !== votingSession.marathonId) {
              return Effect.fail(
                new VotingApiError({
                  message: "Submission does not belong to this marathon",
                }),
              );
            }
            return Effect.succeed(s);
          },
          onNone: () =>
            Effect.fail(
              new VotingApiError({
                message: "Submission not found",
              }),
            ),
        });

        // Record the vote
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
        getVotingSubmissions,
        submitVote,
      } as const;
    }),
  },
) {
}
