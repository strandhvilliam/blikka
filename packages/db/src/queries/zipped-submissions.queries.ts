import { Effect } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { marathons, zippedSubmissions } from "../schema"
import { eq } from "drizzle-orm"

export class ZippedSubmissionsQueries extends Effect.Service<ZippedSubmissionsQueries>()(
  "@blikka/db/zipped-submissions-queries",
  {
    dependencies: [DrizzleClient.Default],
    effect: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getZippedSubmissionsByDomain = Effect.fn(
        "ZippedSubmissionsQueries.getZippedSubmissionsByDomain"
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
        "ZippedSubmissionsQueries.getZippedSubmissionsByReferenceRange"
      )(function* ({
        domain,
        competitionClassId,
        minReference,
        maxReference,
      }: {
        domain: string
        competitionClassId: number
        minReference: string
        maxReference: string
      }) {
        const marathon = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
        })
        if (!marathon) {
          return []
        }

        // Query all zippedSubmissions for the marathon with participant relations
        const allZippedSubmissions = yield* db.query.zippedSubmissions.findMany({
          where: eq(zippedSubmissions.marathonId, marathon.id),
          with: {
            participant: {
              with: {
                competitionClass: true,
              },
            },
          },
        })

        // Filter by competitionClassId and reference range
        const minRefNum = Number(minReference)
        const maxRefNum = Number(maxReference)
        const filtered = allZippedSubmissions.filter((zs) => {
          if (!zs.participant.competitionClass) {
            return false
          }
          const refNum = Number(zs.participant.reference)
          return (
            zs.participant.competitionClassId === competitionClassId &&
            refNum >= minRefNum &&
            refNum <= maxRefNum
          )
        })

        // Sort by participant reference
        return filtered.sort(
          (a, b) => Number(a.participant.reference) - Number(b.participant.reference)
        )
      })

      return {
        getZippedSubmissionsByDomain,
        getZippedSubmissionsByReferenceRange,
      }
    }),
  }
) {}
