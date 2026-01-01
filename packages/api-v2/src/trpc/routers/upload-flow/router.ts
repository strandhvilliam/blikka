import "server-only"

import { Effect, Layer, Option } from "effect"
import { Database } from "@blikka/db"
import {
  GetPublicMarathonSchema,
  InitializeUploadFlowError,
  InitializeUploadFlowSchema,
} from "./schemas"
import { trpcEffect } from "../../utils"
import { createTRPCRouter, publicProcedure } from "../../root"
import { UploadFlowService } from "./service"

export const uploadFlowRouter = createTRPCRouter({
  getPublicMarathon: publicProcedure.input(GetPublicMarathonSchema).query(
    trpcEffect(
      Effect.fn("UploadFlowRouter.getPublicMarathon")(function* ({ input }) {
        //TODO: cache this in redis if marathon has started
        const db = yield* Database
        return yield* db.marathonsQueries
          .getMarathonByDomainWithOptions({
            domain: input.domain,
          })
          .pipe(
            Effect.andThen(
              Option.match({
                onSome: (marathon) => Effect.succeed(marathon),
                onNone: () =>
                  new InitializeUploadFlowError({
                    message: "Marathon not found",
                  }),
              })
            )
          )
      })
    )
  ),
  initializeUploadFlow: publicProcedure.input(InitializeUploadFlowSchema).mutation(
    trpcEffect(
      Effect.fn("UploadFlowRouter.initializeUploadFlow")(function* ({ input }) {
        const uploadFlowService = yield* UploadFlowService

        return yield* uploadFlowService.initializeUploadFlow(input)
      })
    )
  ),
})
