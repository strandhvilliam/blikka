import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import { Schema, Effect, Option } from "effect"
import { Database } from "@blikka/db"
import { TRPCError } from "@trpc/server"
import {
  GetByDomainInfiniteInputSchema,
  GetByReferenceInputSchema,
  ParticipantApiError,
} from "./schemas"
import { ParticipantsApiService } from "./service"

export const participantRouter = createTRPCRouter({
  getByDomainInfinite: authProcedure
    .input(GetByDomainInfiniteInputSchema)

    .query(
      trpcEffect(
        Effect.fn("ParticipantRouter.getByDomainInfinite")(function* ({ input, ctx }) {
          yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })
          return yield* ParticipantsApiService.getInfiniteParticipantsByDomain({
            domain: input.domain,
            cursor: input.cursor ?? undefined,
            limit: input.limit ?? undefined,
            search: input.search ?? undefined,
            sortOrder: input.sortOrder ?? undefined,
            competitionClassId: input.competitionClassId ?? undefined,
            deviceGroupId: input.deviceGroupId ?? undefined,
            statusFilter: input.statusFilter ?? undefined,
            excludeStatuses: input.excludeStatuses ? [...input.excludeStatuses] : undefined,
            hasValidationErrors: input.hasValidationErrors ?? undefined,
          })
        })
      )
    ),

  getByReference: authProcedure.input(GetByReferenceInputSchema).query(
    trpcEffect(
      Effect.fn("ParticipantRouter.getByReference")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })
        return yield* ParticipantsApiService.getByReference({
          reference: input.reference,
          domain: input.domain,
        })
      })
    )
  ),
})
