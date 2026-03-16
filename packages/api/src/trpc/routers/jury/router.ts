import "server-only";

import { Effect } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { trpcEffect } from "../../utils";
import {
  GetJuryInvitationsByDomainInputSchema,
  GetJuryInvitationByIdInputSchema,
  CreateJuryInvitationInputSchema,
  UpdateJuryInvitationInputSchema,
  DeleteJuryInvitationInputSchema,
  VerifyJuryTokenSchema,
  GetJurySubmissionsFromTokenSchema,
  GetJuryRatingsByInvitationSchema,
  GetJuryParticipantCountSchema,
  CreateJuryRatingSchema,
  UpdateJuryRatingSchema,
  GetJuryRatingSchema,
  DeleteJuryRatingSchema,
  UpdateJuryInvitationStatusByTokenSchema,
} from "./schemas";
import { JuryApiService } from "./service";

export const juryRouter = createTRPCRouter({
  getJuryInvitationsByDomain: domainProcedure
    .input(GetJuryInvitationsByDomainInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("JuryRouter.getJuryInvitationsByDomain")(function* ({
          input,
        }) {
          return yield* JuryApiService.use((s) =>
            s.getJuryInvitationsByDomain({ domain: input.domain }),
          );
        }),
      ),
    ),

  getJuryInvitationById: domainProcedure
    .input(GetJuryInvitationByIdInputSchema)
    .query(
      trpcEffect(
        Effect.fn("JuryRouter.getJuryInvitationById")(function* ({ input }) {
          return yield* JuryApiService.use((s) =>
            s.getJuryInvitationById({ id: input.id }),
          );
        }),
      ),
    ),

  createJuryInvitation: domainProcedure
    .input(CreateJuryInvitationInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("JuryRouter.createJuryInvitation")(function* ({ input }) {
          return yield* JuryApiService.use((s) =>
            s.createJuryInvitation({
              domain: input.domain,
              data: input.data,
            }),
          );
        }),
      ),
    ),

  updateJuryInvitation: domainProcedure
    .input(UpdateJuryInvitationInputSchema)
    .mutation(
      trpcEffect(
        Effect.fn("JuryRouter.updateJuryInvitation")(function* ({ input }) {
          return yield* JuryApiService.use((s) =>
            s.updateJuryInvitation({
              id: input.id,
              data: input.data,
            }),
          );
        }),
      ),
    ),

  deleteJuryInvitation: domainProcedure
    .input(DeleteJuryInvitationInputSchema)
    .mutation(
      trpcEffect(
        Effect.fn("JuryRouter.deleteJuryInvitation")(function* ({ input }) {
          return yield* JuryApiService.use((s) =>
            s.deleteJuryInvitation({ id: input.id }),
          );
        }),
      ),
    ),

  verifyTokenAndGetInitialData: publicProcedure
    .input(VerifyJuryTokenSchema)
    .query(
      trpcEffect(
        Effect.fn("JuryRouter.verifyTokenAndGetInitialData")(function* ({
          input,
        }) {
          return yield* JuryApiService.use((s) =>
            s.verifyTokenAndGetInitialData(input),
          );
        }),
      ),
    ),

  getJurySubmissionsFromToken: publicProcedure
    .input(GetJurySubmissionsFromTokenSchema)
    .query(
      trpcEffect(
        Effect.fn("JuryRouter.getJurySubmissionsFromToken")(function* ({
          input,
        }) {
          return yield* JuryApiService.use((s) =>
            s.getJurySubmissionsFromToken(input),
          );
        }),
      ),
    ),

  getJuryRatingsByInvitation: publicProcedure
    .input(GetJuryRatingsByInvitationSchema)
    .query(
      trpcEffect(
        Effect.fn("JuryRouter.getJuryRatingsByInvitation")(function* ({
          input,
        }) {
          return yield* JuryApiService.use((s) =>
            s.getJuryRatingsByInvitation(input),
          );
        }),
      ),
    ),

  getJuryParticipantCount: publicProcedure
    .input(GetJuryParticipantCountSchema)
    .query(
      trpcEffect(
        Effect.fn("JuryRouter.getJuryParticipantCount")(function* ({ input }) {
          return yield* JuryApiService.use((s) =>
            s.getJuryParticipantCount(input),
          );
        }),
      ),
    ),

  createRating: publicProcedure.input(CreateJuryRatingSchema).mutation(
    trpcEffect(
      Effect.fn("JuryRouter.createRating")(function* ({ input }) {
        return yield* JuryApiService.use((s) => s.createRating(input));
      }),
    ),
  ),

  updateRating: publicProcedure.input(UpdateJuryRatingSchema).mutation(
    trpcEffect(
      Effect.fn("JuryRouter.updateRating")(function* ({ input }) {
        return yield* JuryApiService.use((s) => s.updateRating(input));
      }),
    ),
  ),

  getRating: publicProcedure.input(GetJuryRatingSchema).query(
    trpcEffect(
      Effect.fn("JuryRouter.getRating")(function* ({ input }) {
        return yield* JuryApiService.use((s) => s.getRating(input));
      }),
    ),
  ),

  deleteRating: publicProcedure.input(DeleteJuryRatingSchema).mutation(
    trpcEffect(
      Effect.fn("JuryRouter.deleteRating")(function* ({ input }) {
        return yield* JuryApiService.use((s) => s.deleteRating(input));
      }),
    ),
  ),

  updateInvitationStatusByToken: publicProcedure
    .input(UpdateJuryInvitationStatusByTokenSchema)
    .mutation(
      trpcEffect(
        Effect.fn("JuryRouter.updateInvitationStatusByToken")(function* ({
          input,
        }) {
          return yield* JuryApiService.use((s) =>
            s.updateInvitationStatusByToken(input),
          );
        }),
      ),
    ),
});
