import "server-only";

import { Effect, Option } from "effect";
import { Database, type VotingSession } from "@blikka/db";
import { VotingApiError } from "./schemas";
import { SMSService } from "@blikka/sms";

export class VotingApiService extends Effect.Service<VotingApiService>()(
  "@blikka/api-v2/VotingApiService",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function*() {
      const db = yield* Database;
      const smsService = yield* SMSService;

      const getVotingSession = Effect.fn("VotingApiService.getVotingSession")(
        function*({ token, domain }: { token: string; domain: string }) {
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

      const startVotingSessions = Effect.fn("VotingApiService.startVotingSessions")(
        function*({ domain }: { domain: string }) {
          const marathonOpt = yield* db.marathonsQueries.getMarathonByDomain({ domain });

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

          const participants = yield* db.participantsQueries

          // create voting sessions for all participants in the marathon (by-camera mode)

        },
      );

      return {
        getVotingSession,
      } as const;
    }),
  },
) {
}
