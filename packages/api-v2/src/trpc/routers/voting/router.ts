import "server-only";

import { Effect } from "effect";
import {
  GetVotingSessionSchema,
  StartVotingSessionsSchema,
  GetSubmissionVoteStatsSchema,
  CreateOrUpdateVotingSessionSchema,
  GetVotingSessionByParticipantSchema,
  GetVotingAdminOverviewSchema,
  CreateManualVotingSessionSchema,
  ResendVotingSessionNotificationSchema,
  GetVotingSubmissionsSchema,
  SubmitVoteSchema,
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

  createOrUpdateVotingSession: domainProcedure
    .input(CreateOrUpdateVotingSessionSchema)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.createOrUpdateVotingSession")(function* ({
          input,
        }) {
          return yield* VotingApiService.createOrUpdateVotingSessionForParticipant(
            input,
          );
        }),
      ),
    ),

  getVotingSessionByParticipant: domainProcedure
    .input(GetVotingSessionByParticipantSchema)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingSessionByParticipant")(function* ({
          input,
        }) {
          return yield* VotingApiService.getVotingSessionByParticipant(input);
        }),
      ),
    ),

  getVotingAdminOverview: domainProcedure
    .input(GetVotingAdminOverviewSchema)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingAdminOverview")(function* ({ input }) {
          return yield* VotingApiService.getVotingAdminOverview(input);
        }),
      ),
    ),

  createManualVotingSession: domainProcedure
    .input(CreateManualVotingSessionSchema)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.createManualVotingSession")(function* ({
          input,
        }) {
          return yield* VotingApiService.createManualVotingSession(input);
        }),
      ),
    ),

  resendVotingSessionNotification: domainProcedure
    .input(ResendVotingSessionNotificationSchema)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.resendVotingSessionNotification")(function* ({
          input,
        }) {
          return yield* VotingApiService.resendVotingSessionNotification(input);
        }),
      ),
    ),

  getVotingSubmissions: publicProcedure.input(GetVotingSubmissionsSchema).query(
    trpcEffect(
      Effect.fn("VotingRouter.getVotingSubmissions")(function* ({ input }) {
        return yield* VotingApiService.getVotingSubmissions(input);
      }),
    ),
  ),

  submitVote: publicProcedure.input(SubmitVoteSchema).mutation(
    trpcEffect(
      Effect.fn("VotingRouter.submitVote")(function* ({ input }) {
        return yield* VotingApiService.submitVote(input);
      }),
    ),
  ),
});
