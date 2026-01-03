import "server-only"

import { Effect } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import {
  GetByDomainInputSchema,
  UpdateMarathonInputSchema,
  ResetMarathonInputSchema,
  GetLogoUploadUrlInputSchema,
  GetTermsUploadUrlInputSchema,
} from "./schemas"
import { MarathonApiService } from "./service"

export const marathonRouter = createTRPCRouter({
  getByDomain: authProcedure.input(GetByDomainInputSchema).query(
    trpcEffect(
      Effect.fn("MarathonRouter.getByDomain")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* MarathonApiService.getMarathonByDomain({ domain: input.domain })
      })
    )
  ),
  getUserMarathons: authProcedure.query(
    trpcEffect(
      Effect.fn("MarathonRouter.getUserMarathons")(function* ({ ctx }) {
        return yield* MarathonApiService.getUserMarathons({ userId: ctx.session.user.id })
      })
    )
  ),
  update: authProcedure.input(UpdateMarathonInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.update")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* MarathonApiService.updateMarathon({ domain: input.domain, data: input.data })
      })
    )
  ),
  reset: authProcedure.input(ResetMarathonInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.reset")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* MarathonApiService.resetMarathon({ domain: input.domain })
      })
    )
  ),
  getLogoUploadUrl: authProcedure.input(GetLogoUploadUrlInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.getLogoUploadUrl")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* MarathonApiService.getLogoUploadUrl({
          domain: input.domain,
          currentKey: input.currentKey ?? null,
        })
      })
    )
  ),
  getTermsUploadUrl: authProcedure.input(GetTermsUploadUrlInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.getTermsUploadUrl")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* MarathonApiService.getTermsUploadUrl({
          domain: input.domain,
        })
      })
    )
  ),
})
