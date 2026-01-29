import "server-only";

import { Effect } from "effect";
import { GetVotingSessionSchema } from "./schemas";
import { trpcEffect } from "../../utils";
import { createTRPCRouter, publicProcedure } from "../../root";
import { VotingApiService } from "./service";

export const votingRouter = createTRPCRouter({
  getVotingSession: publicProcedure.input(GetVotingSessionSchema).query(
    trpcEffect(
      Effect.fn("VotingRouter.getVotingSession")(function* ({ input }) {
        return yield* VotingApiService.getVotingSession(input);
      }),
    ),
  ),
});
