import "server-only"

import { Effect } from "effect"
import { GetPublicMarathonSchema, InitializeUploadFlowSchema } from "./schemas"
import { trpcEffect } from "../../utils"
import { createTRPCRouter, publicProcedure } from "../../root"
import { UploadFlowApiService } from "./service"

export const uploadFlowRouter = createTRPCRouter({
  getPublicMarathon: publicProcedure.input(GetPublicMarathonSchema).query(
    trpcEffect(
      Effect.fn("UploadFlowRouter.getPublicMarathon")(function* ({ input }) {
        return yield* UploadFlowApiService.getPublicMarathon(input)
      })
    )
  ),
  initializeUploadFlow: publicProcedure.input(InitializeUploadFlowSchema).mutation(
    trpcEffect(
      Effect.fn("UploadFlowRouter.initializeUploadFlow")(function* ({ input }) {
        return yield* UploadFlowApiService.initializeUploadFlow(input)
      })
    )
  ),
})
