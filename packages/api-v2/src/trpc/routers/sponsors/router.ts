import "server-only"

import { Effect } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import {
  GetSponsorsByMarathonInputSchema,
  CreateSponsorInputSchema,
  GenerateSponsorUploadUrlInputSchema,
} from "./schemas"
import { SponsorsApiService } from "./service"

export const sponsorsRouter = createTRPCRouter({
  getByMarathon: authProcedure.input(GetSponsorsByMarathonInputSchema).query(
    trpcEffect(
      Effect.fn("SponsorsRouter.getByMarathon")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* SponsorsApiService.getSponsorsByMarathon({
          domain: input.domain,
        })
      })
    )
  ),

  create: authProcedure.input(CreateSponsorInputSchema).mutation(
    trpcEffect(
      Effect.fn("SponsorsRouter.create")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* SponsorsApiService.createSponsor({
          domain: input.domain,
          type: input.type,
          position: input.position,
          key: input.key,
        })
      })
    )
  ),

  generateUploadUrl: authProcedure.input(GenerateSponsorUploadUrlInputSchema).mutation(
    trpcEffect(
      Effect.fn("SponsorsRouter.generateUploadUrl")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* SponsorsApiService.generateUploadUrl({
          domain: input.domain,
          type: input.type,
          position: input.position,
        })
      })
    )
  ),
})

