import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import { Schema, Effect, Option } from "effect"
import { Database } from "@blikka/db"
import { TRPCError } from "@trpc/server"
import { GetByDomainInfiniteInputSchema, GetByReferenceInputSchema } from "./schemas"
import { ParticipantsApiService } from "./service"

export const participantRouter = createTRPCRouter({
  getByDomainInfinite: authProcedure
    .input(GetByDomainInfiniteInputSchema)

    .query(
      trpcEffect(
        Effect.fn("ParticipantRouter.getByDomainInfinite")(function* ({ input }) {
          yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })
          return yield* ParticipantsApiService.getInfiniteParticipantsByDomain(input)
        })
      )
    ),

  getByReference: authProcedure.input(GetByReferenceInputSchema).query(
    trpcEffect(
      Effect.fn("ParticipantRouter.getByReference")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })
        const db = yield* Database
        const result = yield* db.participantsQueries.getParticipantByReference({
          reference: input.reference,
          domain: input.domain,
        })

        if (Option.isNone(result)) {
          return yield* Effect.fail(
            new ParticipantApiError({
              message: "Participant not found",
            })
          )
        }
        return result.value
      })
    )
  ),
})
