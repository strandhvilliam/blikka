import { authProcedure, createTRPCRouter, domainProcedure } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import { Effect } from "effect"
import { GetByDomainInfiniteInputSchema, GetByReferenceInputSchema } from "./schemas"
import { ParticipantsApiService } from "./service"

export const participantRouter = createTRPCRouter({
  getByDomainInfinite: domainProcedure.input(GetByDomainInfiniteInputSchema).query(
    trpcEffect(
      Effect.fn("ParticipantRouter.getByDomainInfinite")(function* ({ input, ctx }) {
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

  getByReference: domainProcedure.input(GetByReferenceInputSchema).query(
    trpcEffect(
      Effect.fn("ParticipantRouter.getByReference")(function* ({ input, ctx }) {
        return yield* ParticipantsApiService.getByReference({
          reference: input.reference,
          domain: input.domain,
        })
      })
    )
  ),
})
