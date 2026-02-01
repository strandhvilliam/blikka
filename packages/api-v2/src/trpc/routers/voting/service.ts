import "server-only";

import { Effect, Option } from "effect";
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

          const marathonResult =
            yield* db.votingQueries.getPublicMarathonByDomain({ domain });

          const marathon = yield* Option.match(marathonResult, {
            onSome: (m) => Effect.succeed(m),
            onNone: () =>
              Effect.fail(
                new VotingApiError({
                  message: `Marathon not found for domain ${domain}`,
                }),
              ),
          });

          return {
            votingSession,
            marathon,
          };
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
                console.log("phoneNumber", phoneNumber);

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

      return {
        getVotingSession,
        startVotingSessions,
        getSubmissionVoteStats,
      } as const;
    }),
  },
) {}
