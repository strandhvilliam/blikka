import 'server-only'

import { Effect, Schema } from 'effect'
import {
  authProcedure,
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from '../root'
import { trpcEffect } from '../utils'
import {
  GetByDomainInputSchema,
  UpdateMarathonInputSchema,
  ResetMarathonInputSchema,
  GetLogoUploadUrlInputSchema,
  GetTermsUploadUrlInputSchema,
  GetCurrentTermsInputSchema,
} from '../../core/marathons/contracts'
import { MarathonService } from '../../core/marathons/service'

export const marathonRouter = createTRPCRouter({
  getByDomain: domainProcedure
    .input(Schema.toStandardSchemaV1(GetByDomainInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('MarathonRouter.getByDomain')(function* ({ input }) {
          return yield* MarathonService.use((s) => s.getMarathonByDomain({ domain: input.domain }))
        }),
      ),
    ),
  getUserMarathons: authProcedure.query(
    trpcEffect(
      Effect.fn('MarathonRouter.getUserMarathons')(function* ({ ctx }) {
        return yield* MarathonService.use((s) =>
          s.getUserMarathons({ userId: ctx.session.user.id }),
        )
      }),
    ),
  ),
  update: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateMarathonInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('MarathonRouter.update')(function* ({ input }) {
          return yield* MarathonService.use((s) =>
            s.updateMarathon({ domain: input.domain, data: input.data }),
          )
        }),
      ),
    ),
  reset: domainProcedure
    .input(Schema.toStandardSchemaV1(ResetMarathonInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('MarathonRouter.reset')(function* ({ input }) {
          return yield* MarathonService.use((s) => s.resetMarathon({ domain: input.domain }))
        }),
      ),
    ),
  getLogoUploadUrl: domainProcedure
    .input(Schema.toStandardSchemaV1(GetLogoUploadUrlInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('MarathonRouter.getLogoUploadUrl')(function* ({ input }) {
          return yield* MarathonService.use((s) =>
            s.getLogoUploadUrl({
              domain: input.domain,
              currentKey: input.currentKey ?? null,
            }),
          )
        }),
      ),
    ),
  getTermsUploadUrl: domainProcedure
    .input(Schema.toStandardSchemaV1(GetTermsUploadUrlInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('MarathonRouter.getTermsUploadUrl')(function* ({ input }) {
          return yield* MarathonService.use((s) =>
            s.getTermsUploadUrl({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),
  getCurrentTerms: domainProcedure
    .input(Schema.toStandardSchemaV1(GetCurrentTermsInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('MarathonRouter.getCurrentTerms')(function* ({ input }) {
          return yield* MarathonService.use((s) =>
            s.getCurrentTerms({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),
})
