import { Effect, Schema } from "effect"
import { createTRPCRouter, authProcedure } from "../root"
import { trpcEffect } from "../utils"

export const authTestRouter = createTRPCRouter({
  getSomething: authProcedure
    .input(
      Schema.standardSchemaV1(
        Schema.Struct({
          name: Schema.String,
        })
      )
    )
    .query(
      trpcEffect(({ input }) =>
        Effect.gen(function* () {
          yield* Effect.sleep(2000)
          return yield* Effect.succeed({ message: `Something, ${input.name}!` })
        })
      )
    ),
})
