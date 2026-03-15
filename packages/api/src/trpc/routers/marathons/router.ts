import "server-only"

import { Effect } from "effect"
import { authProcedure, createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import {
  GetByDomainInputSchema,
  UpdateMarathonInputSchema,
  ResetMarathonInputSchema,
  GetSeedScenarioStatusInputSchema,
  SeedFinishedScenarioInputSchema,
  GetLogoUploadUrlInputSchema,
  GetTermsUploadUrlInputSchema,
  GetCurrentTermsInputSchema,
} from "./schemas"
import { MarathonApiService } from "./service"

export const marathonRouter = createTRPCRouter({
  getByDomain: domainProcedure.input(GetByDomainInputSchema).query(
    trpcEffect(
      Effect.fn("MarathonRouter.getByDomain")(function* ({ input }) {
        return yield* MarathonApiService.use((s) => s.getMarathonByDomain({ domain: input.domain }))
      })
    )
  ),
  getUserMarathons: authProcedure.query(
    trpcEffect(
      Effect.fn("MarathonRouter.getUserMarathons")(function* ({ ctx }) {
        return yield* MarathonApiService.use((s) => s.getUserMarathons({ userId: ctx.session.user.id }))
      })
    )
  ),
  update: domainProcedure.input(UpdateMarathonInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.update")(function* ({ input }) {
        return yield* MarathonApiService.use((s) => s.updateMarathon({ domain: input.domain, data: input.data }))
      })
    )
  ),
  reset: domainProcedure.input(ResetMarathonInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.reset")(function* ({ input }) {
        return yield* MarathonApiService.use((s) => s.resetMarathon({ domain: input.domain }))
      })
    )
  ),
  getLogoUploadUrl: domainProcedure.input(GetLogoUploadUrlInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.getLogoUploadUrl")(function* ({ input }) {
        return yield* MarathonApiService.use((s) => s.getLogoUploadUrl({
          domain: input.domain,
          currentKey: input.currentKey ?? null,
        }))
      })
    )
  ),
  getTermsUploadUrl: domainProcedure.input(GetTermsUploadUrlInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.getTermsUploadUrl")(function* ({ input }) {
        return yield* MarathonApiService.use((s) => s.getTermsUploadUrl({
          domain: input.domain,
        }))
      })
    )
  ),
  getCurrentTerms: domainProcedure.input(GetCurrentTermsInputSchema).query(
    trpcEffect(
      Effect.fn("MarathonRouter.getCurrentTerms")(function* ({ input }) {
        return yield* MarathonApiService.use((s) => s.getCurrentTerms({
          domain: input.domain,
        }))
      })
    )
  ),
  getSeedScenarioStatus: domainProcedure.input(GetSeedScenarioStatusInputSchema).query(
    trpcEffect(
      Effect.fn("MarathonRouter.getSeedScenarioStatus")(function* ({ input, ctx }) {
        const isAdminForDomain = ctx.permissions.some(
          (permission) => permission.domain === input.domain && permission.role === "admin"
        )

        return yield* MarathonApiService.use((s) =>
          s.getSeedScenarioStatusForDomain({
            domain: input.domain,
            isAdminForDomain,
          })
        )
      })
    )
  ),
  seedFinishedScenario: domainProcedure.input(SeedFinishedScenarioInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.seedFinishedScenario")(function* ({ input, ctx }) {
        const isAdminForDomain = ctx.permissions.some(
          (permission) => permission.domain === input.domain && permission.role === "admin"
        )

        return yield* MarathonApiService.use((s) =>
          s.seedFinishedScenarioForDomain({
            domain: input.domain,
            isAdminForDomain,
          })
        )
      })
    )
  ),
})
