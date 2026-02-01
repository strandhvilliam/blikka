import "server-only";

import { Effect } from "effect";
import {
  GetVotingSessionSchema,
  StartVotingSessionsSchema,
  GetSubmissionVoteStatsSchema,
} from "./schemas";
import { trpcEffect } from "../../utils";
import { createTRPCRouter, domainProcedure, publicProcedure } from "../../root";
import { VotingApiService } from "./service";

export const votingRouter = createTRPCRouter({
  getVotingSession: publicProcedure.input(GetVotingSessionSchema).query(
    trpcEffect(
      Effect.fn("VotingRouter.getVotingSession")(function* ({ input }) {
        return yield* VotingApiService.getVotingSession(input);
      }),
    ),
  ),

  startVotingSessions: domainProcedure
    .input(StartVotingSessionsSchema)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.startVotingSessions")(function* ({ input }) {
          return yield* VotingApiService.startVotingSessions(input);
        }),
      ),
    ),

  getSubmissionVoteStats: domainProcedure
    .input(GetSubmissionVoteStatsSchema)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getSubmissionVoteStats")(function* ({ input }) {
          return yield* VotingApiService.getSubmissionVoteStats(input);
        }),
      ),
    ),
});
