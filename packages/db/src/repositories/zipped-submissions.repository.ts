import { Effect, Layer, Context } from 'effect'
import { DrizzleClient } from '../drizzle-client'
import { participants } from '../schema'
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm'
import { DbError } from '../utils'

/** Participant identity needed to plan zip-download chunks (no zip row required). */
interface ParticipantForZipPlanning {
  readonly reference: string
  readonly competitionClass: { readonly id: number; readonly name: string } | null
}

/** Participant statuses considered "ready to download" — finalized uploads. */
const COMPLETED_PARTICIPANT_STATUSES = ['completed', 'verified'] as const

export class ZippedSubmissionsRepository extends Context.Service<
  ZippedSubmissionsRepository,
  {
    /**
     * Completed/verified participants for a marathon domain with their competition class,
     * for planning zip-download chunks without requiring a pre-existing zip row.
     */
    readonly getCompletedParticipantsForZipPlanning: (params: {
      domain: string
    }) => Effect.Effect<ParticipantForZipPlanning[], DbError>
    /**
     * References of completed/verified participants whose numeric reference lies in an
     * inclusive range for a competition class, sorted ascending. Drives generate-on-miss
     * zipping in the downloader.
     */
    readonly getParticipantReferencesInRange: (params: {
      domain: string
      competitionClassId: number
      minReference: number
      maxReference: number
    }) => Effect.Effect<string[], DbError>
    /** Zip coverage for a marathon domain: participant totals, zip count, and missing references. */
    readonly getZipSubmissionStatsByDomain: (params: { domain: string }) => Effect.Effect<
      {
        totalParticipants: number
        withZippedSubmissions: number
        missingReferences: string[]
      },
      DbError
    >
  }
>()('@blikka/db/zipped-submissions-repository') {}

const makeZippedSubmissionsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const getCompletedParticipantsForZipPlanning: ZippedSubmissionsRepository['Service']['getCompletedParticipantsForZipPlanning'] =
    Effect.fn('ZippedSubmissionsRepository.getCompletedParticipantsForZipPlanning')(function* ({
      domain,
    }) {
      const marathon = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
        }),
      )
      if (!marathon) {
        return []
      }
      const result = yield* use((db) =>
        db.query.participants.findMany({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.marathonId, marathon.id),
              operators.inArray(table.status, [...COMPLETED_PARTICIPANT_STATUSES]),
            ),
          columns: {
            reference: true,
          },
          with: {
            competitionClass: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        }),
      )
      return result.map((participant) => ({
        reference: participant.reference,
        competitionClass: participant.competitionClass
          ? { id: participant.competitionClass.id, name: participant.competitionClass.name }
          : null,
      }))
    })

  const getParticipantReferencesInRange: ZippedSubmissionsRepository['Service']['getParticipantReferencesInRange'] =
    Effect.fn('ZippedSubmissionsRepository.getParticipantReferencesInRange')(function* ({
      domain,
      competitionClassId,
      minReference,
      maxReference,
    }) {
      const marathon = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
        }),
      )
      if (!marathon) {
        return []
      }
      const matchingParticipants = yield* use((db) =>
        db
          .select({ reference: participants.reference })
          .from(participants)
          .where(
            and(
              eq(participants.marathonId, marathon.id),
              eq(participants.competitionClassId, competitionClassId),
              inArray(participants.status, [...COMPLETED_PARTICIPANT_STATUSES]),
              gte(sql`CAST(${participants.reference} AS INTEGER)`, minReference),
              lte(sql`CAST(${participants.reference} AS INTEGER)`, maxReference),
            ),
          ),
      )
      return matchingParticipants
        .map((p) => p.reference)
        .sort((a, b) => Number(a) - Number(b))
    })

  const getZipSubmissionStatsByDomain: ZippedSubmissionsRepository['Service']['getZipSubmissionStatsByDomain'] =
    Effect.fn('ZippedSubmissionsRepository.getZipSubmissionStatsByDomain')(function* ({ domain }) {
      const marathon = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
        }),
      )
      if (!marathon) {
        return {
          totalParticipants: 0,
          withZippedSubmissions: 0,
          missingReferences: [],
        }
      }
      const allParticipants = yield* use((db) =>
        db.query.participants.findMany({
          where: (table, operators) => operators.eq(table.marathonId, marathon.id),
          columns: {
            id: true,
            reference: true,
          },
        }),
      )
      if (allParticipants.length === 0) {
        return {
          totalParticipants: 0,
          withZippedSubmissions: 0,
          missingReferences: [],
        }
      }
      const participantIds = allParticipants.map((p) => p.id)
      const zippedSubmissionsData = yield* use((db) =>
        db.query.zippedSubmissions.findMany({
          where: (table, operators) => operators.inArray(table.participantId, participantIds),
          columns: {
            participantId: true,
          },
        }),
      )
      const zippedParticipantIds = new Set(zippedSubmissionsData.map((zs) => zs.participantId))
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

  return ZippedSubmissionsRepository.of({
    getCompletedParticipantsForZipPlanning,
    getParticipantReferencesInRange,
    getZipSubmissionStatsByDomain,
  })
})

export const ZippedSubmissionsRepositoryLayerNoDeps = Layer.effect(
  ZippedSubmissionsRepository,
  makeZippedSubmissionsRepository,
)

export const ZippedSubmissionsRepositoryLayer = ZippedSubmissionsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
