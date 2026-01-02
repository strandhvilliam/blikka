import { Effect, Option } from "effect"
import { Database } from "@blikka/db"
import { ParticipantApiError } from "./schemas"

export class ParticipantsApiService extends Effect.Service<ParticipantsApiService>()(
  "@blikka/api-v2/ParticipantsApiService",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database

      const getInfiniteParticipantsByDomain = Effect.fn(
        "ParticipantsApiService.getInfiniteParticipantsByDomain"
      )(function* ({
        domain,
        cursor,
        limit,
        search,
        sortOrder,
        competitionClassId,
        deviceGroupId,
        statusFilter,
        excludeStatuses,
        hasValidationErrors,
      }) {
        return yield* db.participantsQueries.getInfiniteParticipantsByDomain({
          domain,
          cursor,
          limit,
          search,
          sortOrder,
          competitionClassId,
          deviceGroupId,
          statusFilter,
          excludeStatuses,
          hasValidationErrors,
        })
      })

      const getByReference = Effect.fn("ParticipantsApiService.getByReference")(function* ({
        reference,
        domain,
      }) {
        const result = yield* db.participantsQueries.getParticipantByReference({
          reference,
          domain,
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

      return {
        getInfiniteParticipantsByDomain,
        getByReference,
      } as const
    }),
  }
) {}
