import { createTRPCRouter } from "../../root"
import { authProcedure } from "../../root"
import { Schema } from "effect"
import { trpcEffect } from "../../utils"
import { Effect } from "effect"
import { RunValidationsSchema } from "./schemas"
import { ValidationsApiService } from "./service"

export const validationsRouter = createTRPCRouter({
  runValidations: authProcedure.input(RunValidationsSchema).mutation(
    trpcEffect(
      Effect.fn("ValidationsRouter.runValidations")(function* ({ input }) {
        return yield* ValidationsApiService.runValidations({
          domain: input.domain,
          reference: input.reference,
        })
      })
    )
  ),
})
