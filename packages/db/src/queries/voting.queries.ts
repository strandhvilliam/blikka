import { Effect, Option } from "effect";
import { DrizzleClient } from "../drizzle-client";
import { votingSession, marathons, participants } from "../schema";
import { eq, inArray } from "drizzle-orm";
import type { NewVotingSession } from "../types";

export class VotingQueries extends Effect.Service<VotingQueries>()(
  "@blikka/db/voting-queries",
  {
    dependencies: [DrizzleClient.Default],
    effect: Effect.gen(function*() {
      const db = yield* DrizzleClient;

      const getVotingSessionByToken = Effect.fn(
        "VotingQueries.getVotingSessionByToken",
      )(function*({ token }: { token: string }) {
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
      )(function*({ domain }: { domain: string }) {
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
      )(function*({ marathonId }: { marathonId: number }) {
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
      )(function*({ sessions }: { sessions: NewVotingSession[] }) {
        if (sessions.length === 0) {
          return [];
        }
        const result = yield* db.insert(votingSession).values(sessions).returning();
        return result;
      });

      const updateMultipleLastNotificationSentAt = Effect.fn(
        "VotingQueries.updateLastNotificationSentAt",
      )(function*({ ids, notificationLastSentAt }: { ids: number[], notificationLastSentAt: string | null }) {
        yield* db.update(votingSession).set({ notificationLastSentAt }).where(inArray(votingSession.id, ids));
      });

      return {
        getVotingSessionByToken,
        getPublicMarathonByDomain,
        getParticipantsWithSubmissionsByMarathonId,
        createVotingSessions,
        updateMultipleLastNotificationSentAt,
      } as const;
    }),
  },
) {
}
