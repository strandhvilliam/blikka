import "server-only"

import { Effect, Schema } from "effect"
import {
  GetVotingSessionSchema,
  StartVotingSessionsSchema,
  CloseTopicVotingWindowSchema,
  ReopenTopicVotingWindowSchema,
  StartTiebreakRoundSchema,
  StartVotingSessionsForParticipantsSchema,
  GetSubmissionVoteStatsSchema,
  GetVotingAdminSummarySchema,
  GetVotingRoundsForTopicSchema,
  GetParticipantsWithoutVotingSessionSchema,
  GetVotingLeaderboardPageSchema,
  GetVotingVotersPageSchema,
  CreateManualVotingSessionSchema,
  ResendVotingSessionNotificationSchema,
  UpdateVotingSessionContactSchema,
  GetVotingSubmissionsSchema,
  SubmitVoteSchema,
  ClearVoteSchema,
  DeleteVotingSessionSchema,
} from "../../core/voting/contracts"
import { trpcEffect } from "../utils"
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from "../root"
import { VotingService } from "../../core/voting/service"

export const votingRouter = createTRPCRouter({
  getVotingSession: publicProcedure.input(Schema.toStandardSchemaV1(GetVotingSessionSchema)).query(
    trpcEffect(
      Effect.fn("VotingRouter.getVotingSession")(function* ({ input }) {
        const votingService = yield* VotingService
        return yield* votingService.getVotingSession(input)
      }),
    ),
  ),

  startVotingSessions: domainProcedure
    .input(Schema.toStandardSchemaV1(StartVotingSessionsSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.startVotingSessions")(function* ({ input }) {
          return yield* VotingService.use((s) => s.startVotingSessions(input))
        }),
      ),
    ),

  closeTopicVotingWindow: domainProcedure
    .input(Schema.toStandardSchemaV1(CloseTopicVotingWindowSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.closeTopicVotingWindow")(function* ({ input }) {
          return yield* VotingService.use((s) => s.closeTopicVotingWindow(input))
        }),
      ),
    ),

  reopenTopicVotingWindow: domainProcedure
    .input(Schema.toStandardSchemaV1(ReopenTopicVotingWindowSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.reopenTopicVotingWindow")(function* ({ input }) {
          return yield* VotingService.use((s) => s.reopenTopicVotingWindow(input))
        }),
      ),
    ),

  startTiebreakRound: domainProcedure
    .input(Schema.toStandardSchemaV1(StartTiebreakRoundSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.startTiebreakRound")(function* ({ input }) {
          return yield* VotingService.use((s) => s.startTiebreakRound(input))
        }),
      ),
    ),

  getSubmissionVoteStats: domainProcedure
    .input(Schema.toStandardSchemaV1(GetSubmissionVoteStatsSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getSubmissionVoteStats")(function* ({ input }) {
          return yield* VotingService.use((s) => s.getSubmissionVoteStats(input))
        }),
      ),
    ),

  getVotingAdminSummary: domainProcedure
    .input(Schema.toStandardSchemaV1(GetVotingAdminSummarySchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingAdminSummary")(function* ({ input }) {
          return yield* VotingService.use((s) => s.getVotingAdminSummary(input))
        }),
      ),
    ),

  getParticipantsWithoutVotingSession: domainProcedure
    .input(Schema.toStandardSchemaV1(GetParticipantsWithoutVotingSessionSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getParticipantsWithoutVotingSession")(function* ({ input }) {
          return yield* VotingService.use((s) => s.getParticipantsWithoutVotingSession(input))
        }),
      ),
    ),

  startVotingSessionsForParticipants: domainProcedure
    .input(Schema.toStandardSchemaV1(StartVotingSessionsForParticipantsSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.startVotingSessionsForParticipants")(function* ({ input }) {
          return yield* VotingService.use((s) => s.startVotingSessionsForParticipants(input))
        }),
      ),
    ),

  getVotingRoundsForTopic: domainProcedure
    .input(Schema.toStandardSchemaV1(GetVotingRoundsForTopicSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingRoundsForTopic")(function* ({ input }) {
          return yield* VotingService.use((s) => s.getVotingRoundsForTopic(input))
        }),
      ),
    ),

  getVotingLeaderboardPage: domainProcedure
    .input(Schema.toStandardSchemaV1(GetVotingLeaderboardPageSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingLeaderboardPage")(function* ({ input }) {
          return yield* VotingService.use((s) => s.getVotingLeaderboardPage(input))
        }),
      ),
    ),

  getVotingVotersPage: domainProcedure
    .input(Schema.toStandardSchemaV1(GetVotingVotersPageSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingVotersPage")(function* ({ input }) {
          return yield* VotingService.use((s) => s.getVotingVotersPage(input))
        }),
      ),
    ),

  createManualVotingSession: domainProcedure
    .input(Schema.toStandardSchemaV1(CreateManualVotingSessionSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.createManualVotingSession")(function* ({ input }) {
          return yield* VotingService.use((s) => s.createManualVotingSession(input))
        }),
      ),
    ),

  resendVotingSessionNotification: domainProcedure
    .input(Schema.toStandardSchemaV1(ResendVotingSessionNotificationSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.resendVotingSessionNotification")(function* ({ input }) {
          return yield* VotingService.use((s) => s.resendVotingSessionNotification(input))
        }),
      ),
    ),

  updateVotingSessionContact: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateVotingSessionContactSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.updateVotingSessionContact")(function* ({ input }) {
          return yield* VotingService.use((s) => s.updateVotingSessionContact(input))
        }),
      ),
    ),

  getVotingSubmissions: publicProcedure.input(Schema.toStandardSchemaV1(GetVotingSubmissionsSchema)).query(
    trpcEffect(
      Effect.fn("VotingRouter.getVotingSubmissions")(function* ({ input }) {
        return yield* VotingService.use((s) => s.getVotingSubmissions(input))
      }),
    ),
  ),

  submitVote: publicProcedure.input(Schema.toStandardSchemaV1(SubmitVoteSchema)).mutation(
    trpcEffect(
      Effect.fn("VotingRouter.submitVote")(function* ({ input }) {
        return yield* VotingService.use((s) => s.submitVote(input))
      }),
    ),
  ),

  clearVote: domainProcedure
    .input(Schema.toStandardSchemaV1(ClearVoteSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.clearVote")(function* ({ input }) {
          return yield* VotingService.use((s) => s.clearVote(input))
        }),
      ),
    ),

  deleteVotingSession: domainProcedure
    .input(Schema.toStandardSchemaV1(DeleteVotingSessionSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.deleteVotingSession")(function* ({ input }) {
          return yield* VotingService.use((s) => s.deleteVotingSession(input))
        }),
      ),
    ),
})
