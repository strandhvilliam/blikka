import { Effect, Layer, ServiceMap } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { marathons, participants, zippedSubmissions } from "../schema"
import { eq, inArray, and, gte, lte, sql } from "drizzle-orm"

export class ZippedSubmissionsQueries extends ServiceMap.Service<ZippedSubmissionsQueries>()(
  "@blikka/db/zipped-submissions-queries",
  {
    make: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getZippedSubmissionsByDomain = Effect.fn(
        "ZippedSubmissionsQueries.getZippedSubmissionsByDomain",
      )(function* ({ domain }: { domain: string }) {
        const marathon = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
        })
        if (!marathon) {
          return []
        }
        const result = yield* db.query.zippedSubmissions.findMany({
          where: eq(zippedSubmissions.marathonId, marathon.id),
          with: {
            participant: {
              with: {
                competitionClass: true,
              },
            },
          },
        })
        return result
      })

      const getZippedSubmissionsByReferenceRange = Effect.fn(
        "ZippedSubmissionsQueries.getZippedSubmissionsByReferenceRange",
      )(function* ({
        domain,
        competitionClassId,
        minReference,
        maxReference,
      }: {
        domain: string
        competitionClassId: number
        minReference: number
        maxReference: number
      }) {
        const marathon = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
        })
        if (!marathon) {
          return []
        }

        const matchingParticipants = yield* db
          .select({ id: participants.id })
          .from(participants)
          .where(
            and(
              eq(participants.marathonId, marathon.id),
              eq(participants.competitionClassId, competitionClassId),
              gte(sql`CAST(${participants.reference} AS INTEGER)`, minReference),
              lte(sql`CAST(${participants.reference} AS INTEGER)`, maxReference)
            )
          )

        if (matchingParticipants.length === 0) {
          return []
        }

        const participantIds = matchingParticipants.map((p) => p.id)

        // Fetch zipped submissions for matching participants only
        const result = yield* db.query.zippedSubmissions.findMany({
          where: and(
            eq(zippedSubmissions.marathonId, marathon.id),
            inArray(zippedSubmissions.participantId, participantIds)
          ),
          with: {
            participant: {
              with: {
                competitionClass: true,
              },
            },
          },
        })

        // Sort by numeric reference
        return result.sort(
          (a, b) =>
            Number(a.participant.reference) - Number(b.participant.reference),
        )
      })

      const getZipSubmissionStatsByDomain = Effect.fn(
        "ZippedSubmissionsQueries.getZipSubmissionStatsByDomain",
      )(function* ({ domain }: { domain: string }) {
        const marathon = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
        })
        if (!marathon) {
          return {
            totalParticipants: 0,
            withZippedSubmissions: 0,
            missingReferences: [],
          }
        }

        const allParticipants = yield* db.query.participants.findMany({
          where: eq(participants.marathonId, marathon.id),
          columns: {
            id: true,
            reference: true,
          },
        })

        if (allParticipants.length === 0) {
          return {
            totalParticipants: 0,
            withZippedSubmissions: 0,
            missingReferences: [],
          }
        }

        const participantIds = allParticipants.map((p) => p.id)

        const zippedSubmissionsData =
          yield* db.query.zippedSubmissions.findMany({
            where: inArray(zippedSubmissions.participantId, participantIds),
            columns: {
              participantId: true,
            },
          })

        const zippedParticipantIds = new Set(
          zippedSubmissionsData.map((zs) => zs.participantId),
        )
        const withZippedSubmissions = zippedParticipantIds.size

        const missingReferences = allParticipants
          .filter((p) => !zippedParticipantIds.has(p.id))
          .map((p) => p.reference)
          .sort((a, b) => Number(a) - Number(b))

        return {
          totalParticipants: allParticipants.length,
          withZippedSubmissions,
          missingReferences,
        }
      })

      return {
        getZippedSubmissionsByDomain,
        getZippedSubmissionsByReferenceRange,
        getZipSubmissionStatsByDomain,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  )
}
