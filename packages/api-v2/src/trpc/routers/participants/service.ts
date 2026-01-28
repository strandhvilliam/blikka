import { Effect, Option } from "effect"
import { Database } from "@blikka/db"
import { ParticipantApiError, PublicParticipantSchema } from "./schemas"

export class ParticipantsApiService extends Effect.Service<ParticipantsApiService>()(
  "@blikka/api-v2/ParticipantsApiService",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function*() {
      const db = yield* Database


      const getPublicParticipantByReference = Effect.fn("ParticipantsApiService.getPublicParticipantByReference")(function*({
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

        return PublicParticipantSchema.make({
          reference: result.value.reference,
          domain: result.value.domain,
          status: result.value.status,
          publicSubmissions: result.value.submissions.map((submission) => ({
            topic: {
              name: submission.topic.visibility === "public" ? submission.topic.name : "",
              orderIndex: submission.topic.orderIndex,
            },
            status: submission.status,
            createdAt: submission.createdAt,
            thumbnailKey: submission.thumbnailKey,
          })),
          competitionClass: {
            name: result.value.competitionClass?.name ?? "",
            description: result.value.competitionClass?.description ?? "",
          },
          deviceGroup: {
            name: result.value.deviceGroup?.name ?? "",
            description: result.value.deviceGroup?.description ?? "",
            icon: result.value.deviceGroup?.icon ?? "",
          },
        })
      })

      const getInfiniteParticipantsByDomain = Effect.fn(
        "ParticipantsApiService.getInfiniteParticipantsByDomain"
      )(function*({
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

      const getByReference = Effect.fn("ParticipantsApiService.getByReference")(function*({
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

      const deleteByReference = Effect.fn("ParticipantsApiService.deleteByReference")(function*({
        reference,
        domain,
      }) {
  
        const participant = yield* getByReference({ reference, domain })
        return yield* db.participantsQueries.deleteParticipant({ id: participant.id })
      })

      return {
        getPublicParticipantByReference,
        getInfiniteParticipantsByDomain,
        getByReference,
        deleteByReference,
      } as const
    }),
  }
) {
}
