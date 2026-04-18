import "server-only"

import { Effect } from "effect"
import {
  GetVotingSessionSchema,
  StartVotingSessionsSchema,
  SetTopicVotingWindowSchema,
  CloseTopicVotingWindowSchema,
  ReopenTopicVotingWindowSchema,
  StartTiebreakRoundSchema,
  StartVotingSessionsForParticipantsSchema,
  GetSubmissionVoteStatsSchema,
  CreateOrUpdateVotingSessionSchema,
  GetVotingSessionByParticipantSchema,
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
} from "./schemas"
import { trpcEffect } from "../../utils"
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root"
import { VotingApiService } from "./service"

export const votingRouter = createTRPCRouter({
  getVotingSession: publicProcedure.input(GetVotingSessionSchema).query(
    trpcEffect(
      Effect.fn("VotingRouter.getVotingSession")(function* ({ input }) {
        const votingApiService = yield* VotingApiService
        return yield* votingApiService.getVotingSession(input)
      }),
    ),
  ),

  startVotingSessions: domainProcedure
    .input(StartVotingSessionsSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.startVotingSessions")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.startVotingSessions(input))
        }),
      ),
    ),

  setTopicVotingWindow: domainProcedure
    .input(SetTopicVotingWindowSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.setTopicVotingWindow")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.setTopicVotingWindow(input))
        }),
      ),
    ),

  closeTopicVotingWindow: domainProcedure
    .input(CloseTopicVotingWindowSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.closeTopicVotingWindow")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.closeTopicVotingWindow(input))
        }),
      ),
    ),

  reopenTopicVotingWindow: domainProcedure
    .input(ReopenTopicVotingWindowSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.reopenTopicVotingWindow")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.reopenTopicVotingWindow(input))
        }),
      ),
    ),

  startTiebreakRound: domainProcedure
    .input(StartTiebreakRoundSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.startTiebreakRound")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.startTiebreakRound(input))
        }),
      ),
    ),

  getSubmissionVoteStats: domainProcedure
    .input(GetSubmissionVoteStatsSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getSubmissionVoteStats")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.getSubmissionVoteStats(input))
        }),
      ),
    ),

  createOrUpdateVotingSession: domainProcedure
    .input(CreateOrUpdateVotingSessionSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.createOrUpdateVotingSession")(function* ({ input }) {
          return yield* VotingApiService.use((s) =>
            s.createOrUpdateVotingSessionForParticipant(input),
          )
        }),
      ),
    ),

  getVotingSessionByParticipant: domainProcedure
    .input(GetVotingSessionByParticipantSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingSessionByParticipant")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.getVotingSessionByParticipant(input))
        }),
      ),
    ),

  getVotingAdminSummary: domainProcedure
    .input(GetVotingAdminSummarySchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingAdminSummary")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.getVotingAdminSummary(input))
        }),
      ),
    ),

  getParticipantsWithoutVotingSession: domainProcedure
    .input(GetParticipantsWithoutVotingSessionSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getParticipantsWithoutVotingSession")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.getParticipantsWithoutVotingSession(input))
        }),
      ),
    ),

  startVotingSessionsForParticipants: domainProcedure
    .input(StartVotingSessionsForParticipantsSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.startVotingSessionsForParticipants")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.startVotingSessionsForParticipants(input))
        }),
      ),
    ),

  getVotingRoundsForTopic: domainProcedure
    .input(GetVotingRoundsForTopicSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingRoundsForTopic")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.getVotingRoundsForTopic(input))
        }),
      ),
    ),

  getVotingLeaderboardPage: domainProcedure
    .input(GetVotingLeaderboardPageSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingLeaderboardPage")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.getVotingLeaderboardPage(input))
        }),
      ),
    ),

  getVotingVotersPage: domainProcedure
    .input(GetVotingVotersPageSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("VotingRouter.getVotingVotersPage")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.getVotingVotersPage(input))
        }),
      ),
    ),

  createManualVotingSession: domainProcedure
    .input(CreateManualVotingSessionSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.createManualVotingSession")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.createManualVotingSession(input))
        }),
      ),
    ),

  resendVotingSessionNotification: domainProcedure
    .input(ResendVotingSessionNotificationSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.resendVotingSessionNotification")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.resendVotingSessionNotification(input))
        }),
      ),
    ),

  updateVotingSessionContact: domainProcedure
    .input(UpdateVotingSessionContactSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.updateVotingSessionContact")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.updateVotingSessionContact(input))
        }),
      ),
    ),

  getVotingSubmissions: publicProcedure.input(GetVotingSubmissionsSchema).query(
    trpcEffect(
      Effect.fn("VotingRouter.getVotingSubmissions")(function* ({ input }) {
        return yield* VotingApiService.use((s) => s.getVotingSubmissions(input))
      }),
    ),
  ),

  submitVote: publicProcedure.input(SubmitVoteSchema).mutation(
    trpcEffect(
      Effect.fn("VotingRouter.submitVote")(function* ({ input }) {
        return yield* VotingApiService.use((s) => s.submitVote(input))
      }),
    ),
  ),

  clearVote: domainProcedure
    .input(ClearVoteSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.clearVote")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.clearVote(input))
        }),
      ),
    ),

  deleteVotingSession: domainProcedure
    .input(DeleteVotingSessionSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("VotingRouter.deleteVotingSession")(function* ({ input }) {
          return yield* VotingApiService.use((s) => s.deleteVotingSession(input))
        }),
      ),
    ),
})
