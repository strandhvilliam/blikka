
import { Effect, Schema } from 'effect'
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from '../root'
import { trpcEffect } from '../utils'
import {
  GetJuryInvitationsByDomainInputSchema,
  GetJuryInvitationByIdInputSchema,
  GetJuryReviewResultsByInvitationIdInputSchema,
  CreateJuryInvitationInputSchema,
  DeleteJuryInvitationInputSchema,
  GetJuryInvitationStatisticsByIdInputSchema,
  ResendJuryInvitationEmailInputSchema,
  ExtendJuryInvitationExpiryInputSchema,
  RegenerateJuryInvitationTokenInputSchema,
  VerifyJuryTokenSchema,
  GetJurySubmissionsFromTokenSchema,
  GetJuryRatingsByInvitationSchema,
  GetJuryParticipantCountSchema,
  CreateJuryRatingSchema,
  UpdateJuryRatingSchema,
  DeleteJuryRatingSchema,
  UpdateJuryInvitationStatusByTokenSchema,
} from '../../core/jury/contracts'
import { JuryService } from '../../core/jury/service'

export const juryRouter = createTRPCRouter({
  getJuryInvitationsByDomain: domainProcedure
    .input(Schema.toStandardSchemaV1(GetJuryInvitationsByDomainInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('JuryRouter.getJuryInvitationsByDomain')(function* ({ input }) {
          return yield* JuryService.use((s) =>
            s.getJuryInvitationsByDomain({ domain: input.domain }),
          )
        }),
      ),
    ),

  getJuryInvitationById: domainProcedure
    .input(Schema.toStandardSchemaV1(GetJuryInvitationByIdInputSchema))
    .query(
      trpcEffect(
        Effect.fn('JuryRouter.getJuryInvitationById')(function* ({ input }) {
          return yield* JuryService.use((s) => s.getJuryInvitationById({ id: input.id }))
        }),
      ),
    ),

  getJuryReviewResultsByInvitationId: domainProcedure
    .input(Schema.toStandardSchemaV1(GetJuryReviewResultsByInvitationIdInputSchema))
    .query(
      trpcEffect(
        Effect.fn('JuryRouter.getJuryReviewResultsByInvitationId')(function* ({ input }) {
          return yield* JuryService.use((s) =>
            s.getJuryReviewResultsByInvitationId({
              id: input.id,
            }),
          )
        }),
      ),
    ),

  getJuryInvitationStatisticsById: domainProcedure
    .input(Schema.toStandardSchemaV1(GetJuryInvitationStatisticsByIdInputSchema))
    .query(
      trpcEffect(
        Effect.fn('JuryRouter.getJuryInvitationStatisticsById')(function* ({ input }) {
          return yield* JuryService.use((s) => s.getJuryInvitationStatisticsById({ id: input.id }))
        }),
      ),
    ),

  resendJuryInvitationEmail: domainProcedure
    .input(Schema.toStandardSchemaV1(ResendJuryInvitationEmailInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('JuryRouter.resendJuryInvitationEmail')(function* ({ input }) {
          return yield* JuryService.use((s) =>
            s.resendJuryInvitationEmail({
              id: input.id,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  extendJuryInvitationExpiry: domainProcedure
    .input(Schema.toStandardSchemaV1(ExtendJuryInvitationExpiryInputSchema))
    .mutation(
      trpcEffect(
        Effect.fn('JuryRouter.extendJuryInvitationExpiry')(function* ({ input }) {
          return yield* JuryService.use((s) =>
            s.extendJuryInvitationExpiry({
              id: input.id,
              expiresAt: input.expiresAt,
            }),
          )
        }),
      ),
    ),

  regenerateJuryInvitationToken: domainProcedure
    .input(Schema.toStandardSchemaV1(RegenerateJuryInvitationTokenInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('JuryRouter.regenerateJuryInvitationToken')(function* ({ input }) {
          return yield* JuryService.use((s) =>
            s.regenerateJuryInvitationToken({
              id: input.id,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  createJuryInvitation: domainProcedure
    .input(Schema.toStandardSchemaV1(CreateJuryInvitationInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('JuryRouter.createJuryInvitation')(function* ({ input }) {
          return yield* JuryService.use((s) =>
            s.createJuryInvitation({
              domain: input.domain,
              data: input.data,
            }),
          )
        }),
      ),
    ),

  deleteJuryInvitation: domainProcedure
    .input(Schema.toStandardSchemaV1(DeleteJuryInvitationInputSchema))
    .mutation(
      trpcEffect(
        Effect.fn('JuryRouter.deleteJuryInvitation')(function* ({ input }) {
          return yield* JuryService.use((s) => s.deleteJuryInvitation({ id: input.id }))
        }),
      ),
    ),

  verifyTokenAndGetInitialData: publicProcedure
    .input(Schema.toStandardSchemaV1(VerifyJuryTokenSchema))
    .query(
      trpcEffect(
        Effect.fn('JuryRouter.verifyTokenAndGetInitialData')(function* ({ input }) {
          return yield* JuryService.use((s) => s.verifyTokenAndGetInitialData(input))
        }),
      ),
    ),

  getJurySubmissionsFromToken: publicProcedure
    .input(Schema.toStandardSchemaV1(GetJurySubmissionsFromTokenSchema))
    .query(
      trpcEffect(
        Effect.fn('JuryRouter.getJurySubmissionsFromToken')(function* ({ input }) {
          return yield* JuryService.use((s) => s.getJurySubmissionsFromToken(input))
        }),
      ),
    ),

  getJuryRatingsByInvitation: publicProcedure
    .input(Schema.toStandardSchemaV1(GetJuryRatingsByInvitationSchema))
    .query(
      trpcEffect(
        Effect.fn('JuryRouter.getJuryRatingsByInvitation')(function* ({ input }) {
          return yield* JuryService.use((s) => s.getJuryRatingsByInvitation(input))
        }),
      ),
    ),

  getJuryParticipantCount: publicProcedure
    .input(Schema.toStandardSchemaV1(GetJuryParticipantCountSchema))
    .query(
      trpcEffect(
        Effect.fn('JuryRouter.getJuryParticipantCount')(function* ({ input }) {
          return yield* JuryService.use((s) => s.getJuryParticipantCount(input))
        }),
      ),
    ),

  createRating: publicProcedure.input(Schema.toStandardSchemaV1(CreateJuryRatingSchema)).mutation(
    trpcEffect(
      Effect.fn('JuryRouter.createRating')(function* ({ input }) {
        return yield* JuryService.use((s) => s.createRating(input))
      }),
    ),
  ),

  updateRating: publicProcedure.input(Schema.toStandardSchemaV1(UpdateJuryRatingSchema)).mutation(
    trpcEffect(
      Effect.fn('JuryRouter.updateRating')(function* ({ input }) {
        return yield* JuryService.use((s) => s.updateRating(input))
      }),
    ),
  ),

  deleteRating: publicProcedure.input(Schema.toStandardSchemaV1(DeleteJuryRatingSchema)).mutation(
    trpcEffect(
      Effect.fn('JuryRouter.deleteRating')(function* ({ input }) {
        return yield* JuryService.use((s) => s.deleteRating(input))
      }),
    ),
  ),

  updateInvitationStatusByToken: publicProcedure
    .input(Schema.toStandardSchemaV1(UpdateJuryInvitationStatusByTokenSchema))
    .mutation(
      trpcEffect(
        Effect.fn('JuryRouter.updateInvitationStatusByToken')(function* ({ input }) {
          return yield* JuryService.use((s) => s.updateInvitationStatusByToken(input))
        }),
      ),
    ),
})
