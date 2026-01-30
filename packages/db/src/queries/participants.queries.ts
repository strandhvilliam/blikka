import { Effect, Option } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { participants, validationResults } from "../schema"
import { eq, and, lt, gt, desc, asc, or, ilike, inArray, notInArray, sql } from "drizzle-orm"
import type { NewParticipant } from "../types"
import { SqlError } from "@effect/sql/SqlError"
import { VALIDATION_OUTCOME } from "@blikka/validation"

export class ParticipantsQueries extends Effect.Service<ParticipantsQueries>()(
  "@blikka/db/participants-queries",
  {
    dependencies: [DrizzleClient.Default],
    effect: Effect.gen(function*() {
      const db = yield* DrizzleClient

      const getParticipantById = Effect.fn("ParticipantsQueries.getParticipantByIdQuery")(
        function*({ id }: { id: number }) {
          const result = yield* db.query.participants.findFirst({
            where: eq(participants.id, id),
            with: {
              submissions: true,
              competitionClass: true,
              deviceGroup: true,
              validationResults: true,
              zippedSubmissions: true,
            },
          })

          return Option.fromNullable(result)
        }
      )

      const getParticipantByReference = Effect.fn(
        "ParticipantsQueries.getParticipantByReferenceQuery"
      )(function*({ reference, domain }: { reference: string; domain: string }) {
        const result = yield* db.query.participants.findFirst({
          where: and(eq(participants.reference, reference), eq(participants.domain, domain)),
          with: {
            submissions: {
              with: {
                topic: true,
              },
            },
            competitionClass: true,
            deviceGroup: true,
            validationResults: true,
            zippedSubmissions: true,
            contactSheets: true,
          },
        })

        return Option.fromNullable(result)
      })

      const getInfiniteParticipantsByDomain = Effect.fn(
        "ParticipantsQueries.getInfiniteParticipantsByDomainQuery"
      )(function*({
        domain,
        cursor,
        limit = 50,
        search,
        sortOrder = "desc",
        competitionClassId,
        deviceGroupId,
        statusFilter,
        excludeStatuses,
        hasValidationErrors,
      }: {
        domain: string
        cursor?: string
        limit?: number
        search?: string
        sortOrder?: "asc" | "desc"
        competitionClassId?: number | number[] | readonly number[]
        deviceGroupId?: number | number[] | readonly number[]
        statusFilter?: "completed" | "verified"
        excludeStatuses?: string[]
        hasValidationErrors?: boolean
      }) {
        const cursorId = cursor ? parseInt(cursor, 10) : undefined
        const isValidCursor = cursorId !== undefined && !isNaN(cursorId)

        const baseConditions = [eq(participants.domain, domain)]

        if (isValidCursor) {
          if (sortOrder === "desc") {
            baseConditions.push(lt(participants.id, cursorId!))
          } else {
            baseConditions.push(gt(participants.id, cursorId!))
          }
        }

        if (competitionClassId !== undefined) {
          if (Array.isArray(competitionClassId)) {
            const ids: number[] = [...competitionClassId]
            baseConditions.push(inArray(participants.competitionClassId, ids))
          } else {
            baseConditions.push(eq(participants.competitionClassId, competitionClassId as number))
          }
        }

        if (deviceGroupId !== undefined) {
          if (Array.isArray(deviceGroupId)) {
            const ids: number[] = [...deviceGroupId]
            baseConditions.push(inArray(participants.deviceGroupId, ids))
          } else {
            baseConditions.push(eq(participants.deviceGroupId, deviceGroupId as number))
          }
        }

        if (search && search.trim().length > 0) {
          const searchPattern = `%${search.trim()}%`
          const searchCondition = or(
            ilike(participants.reference, searchPattern),
            ilike(participants.firstname, searchPattern),
            ilike(participants.lastname, searchPattern),
            ilike(participants.email, searchPattern)
          )
          if (searchCondition) {
            baseConditions.push(searchCondition)
          }
        }

        if (statusFilter) {
          baseConditions.push(eq(participants.status, statusFilter))
        }

        if (excludeStatuses && excludeStatuses.length > 0) {
          baseConditions.push(notInArray(participants.status, excludeStatuses))
        }

        if (hasValidationErrors) {
          // Filter participants that have validation results with outcome = "failed" and (severity = "error" OR severity = "warning")
          // First, get participant IDs that have validation errors for this domain
          const participantsWithErrors = yield* db
            .selectDistinct({ participantId: validationResults.participantId })
            .from(validationResults)
            .innerJoin(participants, eq(participants.id, validationResults.participantId))
            .where(
              and(
                eq(participants.domain, domain),
                eq(validationResults.outcome, VALIDATION_OUTCOME.FAILED),
                or(
                  eq(validationResults.severity, "error"),
                  eq(validationResults.severity, "warning")
                )
              )
            )

          const participantIdsWithErrors = participantsWithErrors.map((p) => p.participantId)

          if (participantIdsWithErrors.length === 0) {
            // If no participants have validation errors, return empty result
            return {
              participants: [],
              nextCursor: null,
            }
          }

          baseConditions.push(inArray(participants.id, participantIdsWithErrors))
        }

        const whereConditions =
          baseConditions.length > 1 ? and(...baseConditions) : baseConditions[0]

        const participant = yield* db.query.participants.findMany({
          where: whereConditions,
          columns: {
            phoneHash: false,
            phoneEncrypted: false,
          },
          with: {
            competitionClass: true,
            deviceGroup: true,
            validationResults: true,
            votingSession: {
              columns: {
                token: true,
                voteSubmissionId: true,
                votedAt: true
              },
            },
            zippedSubmissions: {
              columns: {
                key: true,
              },
            },
            contactSheets: {
              columns: {
                key: true,
              },
            },
          },
          limit: limit + 1,
          orderBy: sortOrder === "desc" ? [desc(participants.id)] : [asc(participants.id)],
        })

        //TODO: can optimize this to a single query with some sql magic
        function countValidationResults(
          validations: { outcome: string; severity: string }[],
          outcome: string
        ) {
          return validations
            .filter((vr) => vr.outcome === outcome)
            .reduce(
              (acc, vr) => {
                if (vr.severity === "error") acc.errors++
                else if (vr.severity === "warning") acc.warnings++
                return acc
              },
              { errors: 0, warnings: 0 }
            )
        }

        let nextCursor: string | null = null
        let participantsToReturn = participant

        // If we got more than the limit, there's a next page
        if (participant.length > limit) {
          participantsToReturn = participant.slice(0, limit)
          const lastParticipant = participantsToReturn[participantsToReturn.length - 1]
          nextCursor = lastParticipant ? lastParticipant.id.toString() : null
        }

        const mappedResult = participantsToReturn.map(
          ({ validationResults, zippedSubmissions, contactSheets, ...rest }) => ({
            ...rest,
            zipKeys: zippedSubmissions.map((zs) => zs.key),
            contactSheetKeys: contactSheets.map((cs) => cs.key),
            failedValidationResults: countValidationResults(
              validationResults,
              VALIDATION_OUTCOME.FAILED
            ),
            passedValidationResults: countValidationResults(
              validationResults,
              VALIDATION_OUTCOME.PASSED
            ),
            skippedValidationResults: countValidationResults(
              validationResults,
              VALIDATION_OUTCOME.SKIPPED
            ),
          })
        )

        return {
          participants: mappedResult,
          nextCursor,
        }
      })

      const createParticipant = Effect.fn("ParticipantsQueries.createParticipantMutation")(
        function*({ data }: { data: NewParticipant }) {
          if (!data.domain) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Domain is required",
              })
            )
          }

          const [result] = yield* db.insert(participants).values(data).returning()

          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to create participant",
                message: "Failed to create participant",
              })
            )
          }

          return result
        }
      )

      const updateParticipantById = Effect.fn("ParticipantsQueries.updateParticipantMutation")(
        function*({ id, data }: { id: number; data: Partial<NewParticipant> }) {
          const [result] = yield* db
            .update(participants)
            .set(data)
            .where(eq(participants.id, id))
            .returning()

          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to update participant",
              })
            )
          }

          return result
        }
      )

      const updateParticipantByReference = Effect.fn(
        "ParticipantsQueries.updateParticipantByReference"
      )(function*({
        reference,
        domain,
        data,
      }: {
        reference: string
        domain: string
        data: Partial<NewParticipant>
      }) {
        const [result] = yield* db
          .update(participants)
          .set(data)
          .where(and(eq(participants.reference, reference), eq(participants.domain, domain)))
          .returning({ id: participants.id })
        if (!result) {
          return yield* Effect.fail(
            new SqlError({
              cause: "Failed to update participant",
            })
          )
        }
        return result
      })

      const deleteParticipant = Effect.fn("ParticipantsQueries.deleteParticipantMutation")(
        function*({ id }: { id: number }) {
          const [result] = yield* db.delete(participants).where(eq(participants.id, id)).returning()
          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to delete participant",
              })
            )
          }
          return result
        }
      )


      return {
        getParticipantById,
        getParticipantByReference,
        getInfiniteParticipantsByDomain,
        createParticipant,
        updateParticipantById,
        updateParticipantByReference,
        deleteParticipant,
      } as const 
    }),
  }
) {
}
