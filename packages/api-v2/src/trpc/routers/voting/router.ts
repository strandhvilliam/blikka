import "server-only";

import { Effect } from "effect";
import {
  GetVotingSessionSchema,
  StartVotingSessionsSchema,
  GetSubmissionVoteStatsSchema,
  CreateOrUpdateVotingSessionSchema,
  GetVotingSessionByParticipantSchema,
  GetVotingAdminSummarySchema,
  GetVotingLeaderboardPageSchema,
  GetVotingVotersPageSchema,
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

  getVotingAdminSummary: domainProcedure
    .input(GetVotingAdminSummarySchema)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingAdminSummary")(function* ({ input }) {
          return yield* VotingApiService.getVotingAdminSummary(input);
        }),
      ),
    ),

  getVotingLeaderboardPage: domainProcedure
    .input(GetVotingLeaderboardPageSchema)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingLeaderboardPage")(function* ({
          input,
        }) {
          return yield* VotingApiService.getVotingLeaderboardPage(input);
        }),
      ),
    ),

  getVotingVotersPage: domainProcedure
    .input(GetVotingVotersPageSchema)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingVotersPage")(function* ({ input }) {
          return yield* VotingApiService.getVotingVotersPage(input);
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
