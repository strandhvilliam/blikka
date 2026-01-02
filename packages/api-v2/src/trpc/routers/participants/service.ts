export class ParticipantsApiService extends Effect.Service<ParticipantsApiService>()(
  "@blikka/api-v2/participants-api-service",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database

      const getInfiniteParticipantsByDomain = Effect.fn(
        "ParticipantsApiService.getInfiniteParticipantsByDomain"
      )(function* ({ input }: { input: GetByDomainInfiniteInputSchema }) {
        return yield* db.participantsQueries.getInfiniteParticipantsByDomain({
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
    }),
  }
) {}
