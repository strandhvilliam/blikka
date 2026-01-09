import "server-only"

import { Effect } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import {
  GetSponsorsByMarathonInputSchema,
  CreateSponsorInputSchema,
  GenerateSponsorUploadUrlInputSchema,
} from "./schemas"
import { SponsorsApiService } from "./service"

export const sponsorsRouter = createTRPCRouter({
  getByMarathon: domainProcedure.input(GetSponsorsByMarathonInputSchema).query(
    trpcEffect(
      Effect.fn("SponsorsRouter.getByMarathon")(function* ({ input, ctx }) {
        return yield* SponsorsApiService.getSponsorsByMarathon({
          domain: input.domain,
        })
      })
    )
  ),

  create: domainProcedure.input(CreateSponsorInputSchema).mutation(
    trpcEffect(
      Effect.fn("SponsorsRouter.create")(function* ({ input }) {
        return yield* SponsorsApiService.createSponsor({
          domain: input.domain,
          type: input.type,
          position: input.position,
          key: input.key,
        })
      })
    )
  ),

  generateUploadUrl: domainProcedure.input(GenerateSponsorUploadUrlInputSchema).mutation(
    trpcEffect(
      Effect.fn("SponsorsRouter.generateUploadUrl")(function* ({ input }) {
        return yield* SponsorsApiService.generateUploadUrl({
          domain: input.domain,
          type: input.type,
          position: input.position,
        })
      })
    )
  ),
})
