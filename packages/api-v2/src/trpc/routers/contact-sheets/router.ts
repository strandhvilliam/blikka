import "server-only"

import { Effect } from "effect"
import { GenerateContactSheetSchema } from "./schemas"
import { trpcEffect } from "../../utils"
import { createTRPCRouter, publicProcedure } from "../../root"
import { ContactSheetsApiService } from "./service"

export const contactSheetsRouter = createTRPCRouter({
  generateContactSheet: publicProcedure.input(GenerateContactSheetSchema).mutation(
    trpcEffect(
      Effect.fn("ContactSheetsRouter.generateContactSheet")(function* ({ input }) {
        return yield* ContactSheetsApiService.generateContactSheet({
          domain: input.domain,
          reference: input.reference,
        })
      })
    )
  ),
})
