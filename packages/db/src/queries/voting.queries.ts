import { Effect, Option } from "effect";
import { DrizzleClient } from "../drizzle-client";
import { votingSession, marathons } from "../schema";
import { eq } from "drizzle-orm";

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

      return {
        getVotingSessionByToken,
        getPublicMarathonByDomain,
      } as const;
    }),
  },
) {}
