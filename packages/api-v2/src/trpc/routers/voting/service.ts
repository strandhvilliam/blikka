import "server-only";

import { Effect, Option } from "effect";
import { Database, type VotingSession } from "@blikka/db";
import { VotingApiError } from "./schemas";

export class VotingApiService extends Effect.Service<VotingApiService>()(
  "@blikka/api-v2/VotingApiService",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database;

      const getVotingSession = Effect.fn("VotingApiService.getVotingSession")(
        function* ({ token, domain }: { token: string; domain: string }) {
          // Get voting session by token
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

          // Check if session has expired
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

          // Get public marathon data
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

      return {
        getVotingSession,
      } as const;
    }),
  },
) {}
