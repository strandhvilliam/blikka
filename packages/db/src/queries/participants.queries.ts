import { Effect, Layer, Option, ServiceMap } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { participants, submissions, validationResults } from "../schema"
import {
  eq,
  and,
  or,
  inArray,
} from "drizzle-orm"
import type { NewParticipant } from "../types"
import { DbError } from "../utils"
import { VALIDATION_OUTCOME } from "@blikka/validation"

export class ParticipantsQueries extends ServiceMap.Service<ParticipantsQueries>()(
  "@blikka/db/participants-queries",
  {
    make: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getParticipantById = Effect.fn(
        "ParticipantsQueries.getParticipantByIdQuery",
      )(function* ({ id }: { id: number }) {
        const result = yield* db.query.participants.findFirst({
          where: { id },
          with: {
            submissions: true,
            competitionClass: true,
            deviceGroup: true,
            validationResults: true,
            zippedSubmissions: true,
          },
        })

        return Option.fromNullishOr(result)
      })

      const getParticipantByReference = Effect.fn(
        "ParticipantsQueries.getParticipantByReferenceQuery",
      )(function* ({
        reference,
        domain,
      }: {
        reference: string
        domain: string
      }) {
        const result = yield* db.query.participants.findFirst({
          where: { reference, domain },
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

        return Option.fromNullishOr(result)
      })

      const getInfiniteParticipantsByDomain = Effect.fn(
        "ParticipantsQueries.getInfiniteParticipantsByDomainQuery",
      )(function* ({
        domain,
        cursor,
        limit = 50,
        search,
        sortOrder = "desc",
        competitionClassId,
        deviceGroupId,
        topicId,
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
        topicId?: number
        statusFilter?: "completed" | "verified"
        excludeStatuses?: string[]
        hasValidationErrors?: boolean
      }) {
        const cursorId = cursor ? parseInt(cursor, 10) : undefined
        const isValidCursor = cursorId !== undefined && !isNaN(cursorId)

        const baseConditions: any[] = [{ domain }]

        if (isValidCursor) {
          if (sortOrder === "desc") {
            baseConditions.push({ id: { lt: cursorId! } })
          } else {
            baseConditions.push({ id: { gt: cursorId! } })
          }
        }

        if (competitionClassId !== undefined) {
          if (Array.isArray(competitionClassId)) {
            baseConditions.push({ competitionClassId: { in: [...competitionClassId] } })
          } else {
            baseConditions.push({ competitionClassId: competitionClassId as number })
          }
        }

        if (deviceGroupId !== undefined) {
          if (Array.isArray(deviceGroupId)) {
            baseConditions.push({ deviceGroupId: { in: [...deviceGroupId] } })
          } else {
            baseConditions.push({ deviceGroupId: deviceGroupId as number })
          }
        }

        if (search && search.trim().length > 0) {
          const searchPattern = `%${search.trim()}%`
          baseConditions.push({
            OR: [
              { reference: { ilike: searchPattern } },
              { firstname: { ilike: searchPattern } },
              { lastname: { ilike: searchPattern } },
              { email: { ilike: searchPattern } },
            ],
          })
        }

        if (statusFilter) {
          baseConditions.push({ status: statusFilter })
        }

        if (excludeStatuses && excludeStatuses.length > 0) {
          baseConditions.push({ status: { notIn: excludeStatuses } })
        }

        if (hasValidationErrors) {
          const participantsWithErrors = yield* db
            .selectDistinct({ participantId: validationResults.participantId })
            .from(validationResults)
            .innerJoin(
              participants,
              eq(participants.id, validationResults.participantId),
            )
            .where(
              and(
                eq(participants.domain, domain),
                eq(validationResults.outcome, VALIDATION_OUTCOME.FAILED),
                or(
                  eq(validationResults.severity, "error"),
                  eq(validationResults.severity, "warning"),
                ),
              ),
            )

          const participantIdsWithErrors = participantsWithErrors.map(
            (p) => p.participantId,
          )

          if (participantIdsWithErrors.length === 0) {
            return {
              participants: [],
              nextCursor: null,
            }
          }

          baseConditions.push({ id: { in: participantIdsWithErrors } })
        }

        if (topicId !== undefined) {
          const participantsWithTopicSubmissions = yield* db
            .selectDistinct({ participantId: submissions.participantId })
            .from(submissions)
            .innerJoin(participants, eq(participants.id, submissions.participantId))
            .where(
              and(
                eq(participants.domain, domain),
                eq(submissions.topicId, topicId),
              ),
            )

          const participantIdsWithTopicSubmissions =
            participantsWithTopicSubmissions.map((p) => p.participantId)

          if (participantIdsWithTopicSubmissions.length === 0) {
            return {
              participants: [],
              nextCursor: null,
            }
          }

          baseConditions.push({ id: { in: participantIdsWithTopicSubmissions } })
        }

        const whereCondition = baseConditions.length === 1
          ? baseConditions[0]
          : { AND: baseConditions }

        const participant = yield* db.query.participants.findMany({
          where: whereCondition,
          columns: {
            phoneHash: false,
            phoneEncrypted: false,
          },
          with: {
            competitionClass: true,
            deviceGroup: true,
            ...(topicId !== undefined
              ? {
                submissions: {
                  columns: {
                    id: true,
                    topicId: true,
                    createdAt: true,
                  },
                  where: { topicId },
                },
              }
              : {}),
            validationResults: true,
            votingSessions: {
              columns: {
                token: true,
                voteSubmissionId: true,
                votedAt: true,
                topicId: true,
                createdAt: true,
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
          orderBy: sortOrder === "desc" ? { id: "desc" } : { id: "asc" },
        })

        function countValidationResults(
          validations: { outcome: string; severity: string }[],
          outcome: string,
        ) {
          return validations
            .filter((vr) => vr.outcome === outcome)
            .reduce(
              (acc, vr) => {
                if (vr.severity === "error") acc.errors++
                else if (vr.severity === "warning") acc.warnings++
                return acc
              },
              { errors: 0, warnings: 0 },
            )
        }

        let nextCursor: string | null = null
        let participantsToReturn = participant

        if (participant.length > limit) {
          participantsToReturn = participant.slice(0, limit)
          const lastParticipant =
            participantsToReturn[participantsToReturn.length - 1]
          nextCursor = lastParticipant ? lastParticipant.id.toString() : null
        }

        const mappedResult = participantsToReturn.map(
          ({
            validationResults,
            zippedSubmissions,
            contactSheets,
            votingSessions,
            submissions: participantSubmissions = [],
            ...rest
          }) => {
            const activeTopicSubmissionId =
              topicId === undefined
                ? null
                : participantSubmissions
                  .sort(
                    (left, right) =>
                      new Date(right.createdAt).getTime() -
                      new Date(left.createdAt).getTime(),
                  )[0]?.id ?? null

            return {
              ...rest,
              activeTopicSubmissionId,
              votingSession:
                votingSessions
                  .filter((session) =>
                    topicId !== undefined ? session.topicId === topicId : true,
                  )
                  .sort(
                    (left, right) =>
                      new Date(right.createdAt).getTime() -
                      new Date(left.createdAt).getTime(),
                  )[0] ?? null,
              zipKeys: zippedSubmissions.map((zs) => zs.key),
              contactSheetKeys: contactSheets.map((cs) => cs.key),
              failedValidationResults: countValidationResults(
                validationResults,
                VALIDATION_OUTCOME.FAILED,
              ),
              passedValidationResults: countValidationResults(
                validationResults,
                VALIDATION_OUTCOME.PASSED,
              ),
              skippedValidationResults: countValidationResults(
                validationResults,
                VALIDATION_OUTCOME.SKIPPED,
              ),
            }
          },
        )

        return {
          participants: mappedResult,
          nextCursor,
        }
      })

      const createParticipant = Effect.fn(
        "ParticipantsQueries.createParticipantMutation",
      )(function* ({ data }: { data: NewParticipant }) {
        if (!data.domain) {
          return yield* Effect.fail(
            new DbError({
              message: "Domain is required",
            }),
          )
        }

        const [result] = yield* db
          .insert(participants)
          .values(data)
          .returning()

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to create participant",
            }),
          )
        }

        return result
      })

      const updateParticipantById = Effect.fn(
        "ParticipantsQueries.updateParticipantMutation",
      )(function* ({
        id,
        data,
      }: {
        id: number
        data: Partial<NewParticipant>
      }) {
        const [result] = yield* db
          .update(participants)
          .set(data)
          .where(eq(participants.id, id))
          .returning()

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update participant",
            }),
          )
        }

        return result
      })

      const updateParticipantByReference = Effect.fn(
        "ParticipantsQueries.updateParticipantByReference",
      )(function* ({
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
          .where(
            and(
              eq(participants.reference, reference),
              eq(participants.domain, domain),
            ),
          )
          .returning({ id: participants.id })
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update participant",
            }),
          )
        }
        return result
      })

      const deleteParticipant = Effect.fn(
        "ParticipantsQueries.deleteParticipantMutation",
      )(function* ({ id }: { id: number }) {
        const [result] = yield* db
          .delete(participants)
          .where(eq(participants.id, id))
          .returning()
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to delete participant",
            }),
          )
        }
        return result
      })

      const batchDeleteParticipants = Effect.fn(
        "ParticipantsQueries.batchDeleteParticipants",
      )(function* ({ ids, domain }: { ids: number[]; domain: string }) {
        if (ids.length === 0) {
          return { deletedCount: 0, failedIds: [] }
        }

        const results = yield* db
          .delete(participants)
          .where(
            and(eq(participants.domain, domain), inArray(participants.id, ids)),
          )
          .returning({ id: participants.id })

        const deletedIds = results.map((r) => r.id)
        const failedIds = ids.filter((id) => !deletedIds.includes(id))

        return {
          deletedCount: deletedIds.length,
          failedIds,
        }
      })

      const batchVerifyParticipants = Effect.fn(
        "ParticipantsQueries.batchVerifyParticipants",
      )(function* ({ ids, domain }: { ids: number[]; domain: string }) {
        if (ids.length === 0) {
          return { updatedCount: 0, failedIds: [] }
        }

        const results = yield* db
          .update(participants)
          .set({ status: "verified" })
          .where(
            and(
              eq(participants.domain, domain),
              inArray(participants.id, ids),
              eq(participants.status, "completed"),
            ),
          )
          .returning({ id: participants.id })

        const updatedIds = results.map((r) => r.id)
        const failedIds = ids.filter((id) => !updatedIds.includes(id))

        return {
          updatedCount: updatedIds.length,
          failedIds,
        }
      })

      return {
        getParticipantById,
        getParticipantByReference,
        getInfiniteParticipantsByDomain,
        createParticipant,
        updateParticipantById,
        updateParticipantByReference,
        deleteParticipant,
        batchDeleteParticipants,
        batchVerifyParticipants,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer)
  )
}
