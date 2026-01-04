import { Effect } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { and, eq, inArray, notInArray, lt } from "drizzle-orm"
import { marathons, participants, participantVerifications, validationResults } from "../schema"
import type { NewParticipantVerification, NewValidationResult, ValidationResult } from "../types"
import { SqlError } from "@effect/sql/SqlError"

export class ValidationsQueries extends Effect.Service<ValidationsQueries>()(
  "@blikka/db/validations-queries",
  {
    dependencies: [DrizzleClient.Default],
    effect: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getValidationResultsByParticipantId = Effect.fn(
        "ValidationsQueries.getValidationResultsByParticipantId"
      )(function* ({ participantId }: { participantId: number }) {
        const result = yield* db.query.validationResults.findMany({
          where: eq(validationResults.participantId, participantId),
        })

        return result
      })

      const getValidationResultsByDomain = Effect.fn(
        "ValidationsQueries.getValidationResultsByDomain"
      )(function* ({ domain }: { domain: string }) {
        const result = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
          with: {
            participants: {
              with: { submissions: true, validationResults: true },
            },
          },
        })

        return (
          result?.participants.flatMap((p) => {
            return p.submissions.map((s) => {
              const { submissions: _, validationResults: __, ...rest } = p
              return {
                ...s,
                participant: rest,
                globalValidationResults: p.validationResults.filter((vr) => !vr.fileName),
                validationResults: p.validationResults.filter((vr) => vr.fileName === s.key),
              }
            })
          }) ?? []
        )
      })

      const getParticipantVerificationsByStaffId = Effect.fn(
        "ValidationsQueries.getParticipantVerificationsByStaffId"
      )(function* ({
        staffId,
        domain,
        cursor,
        limit = 20,
      }: {
        staffId: string
        domain: string
        cursor?: number
        limit?: number
      }) {
        const result = yield* db.query.participantVerifications.findMany({
          where: cursor
            ? and(eq(participantVerifications.staffId, staffId), lt(participantVerifications.id, cursor))
            : eq(participantVerifications.staffId, staffId),
          with: {
            participant: {
              with: {
                competitionClass: true,
                deviceGroup: true,
                validationResults: true,
                submissions: true,
                marathon: true,
              },
            },
          },
          orderBy: (participantVerifications, { desc }) => [
            desc(participantVerifications.createdAt),
          ],
          limit: limit + 1,
        })

        const filteredResults = result
          .filter((v) => v.participant.marathon.domain === domain)
          .map((v) => ({
            ...v,
            participant: { ...v.participant, marathon: undefined },
          }))

        const hasMore = filteredResults.length > limit
        const items = hasMore ? filteredResults.slice(0, limit) : filteredResults
        const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

        return {
          items,
          nextCursor,
        }
      })

      const createValidationResult = Effect.fn("ValidationsQueries.createValidationResult")(
        function* ({ data }: { data: NewValidationResult }) {
          const [result] = yield* db.insert(validationResults).values(data).returning()

          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to create validation result",
              })
            )
          }

          return result
        }
      )

      const createMultipleValidationResults = Effect.fn(
        "ValidationsQueries.createMultipleValidationResults"
      )(function* ({
        data,
        domain,
        reference,
      }: {
        domain: string
        reference: string
        data: Omit<NewValidationResult, "participantId">[]
      }) {
        const participant = yield* db.query.participants.findFirst({
          where: and(eq(participants.domain, domain), eq(participants.reference, reference)),
        })

        if (!participant) {
          return yield* new SqlError({
            message: "Participant not found",
            cause: new Error("Participant not found"),
          })
        }

        const existingValidationResults = yield* db.query.validationResults.findMany({
          where: eq(validationResults.participantId, participant.id),
        })

        const existingValidationResultsMap = new Map(
          existingValidationResults.map((r) => [
            r.fileName
              ? `${r.participantId}-${r.fileName}-${r.ruleKey}`
              : `${r.participantId}-${r.ruleKey}`,
            r,
          ])
        )

        const { toCreate, toUpdate } = data.reduce(
          (acc, d) => {
            const key = d.fileName
              ? `${participant.id}-${d.fileName}-${d.ruleKey}`
              : `${participant.id}-${d.ruleKey}`
            if (existingValidationResultsMap.has(key)) {
              acc.toUpdate.push({
                ...d,
                participantId: participant.id,
                id: existingValidationResultsMap.get(key)?.id,
              })
            } else {
              acc.toCreate.push({
                ...d,
                participantId: participant.id,
              })
            }
            return acc
          },
          {
            toCreate: [] as NewValidationResult[],
            toUpdate: [] as NewValidationResult[],
          }
        )

        const result: ValidationResult[] = []
        if (toCreate.length > 0) {
          const created = yield* db.insert(validationResults).values(toCreate).returning()
          result.push(...created)
        }

        for (const r of toUpdate.filter((r) => r.id)) {
          if (!r.id) {
            continue
          }
          const updated = yield* updateValidationResult({
            id: r.id,
            data: r,
          })
          result.push(updated)
        }

        return result
      })

      const updateValidationResult = Effect.fn("ValidationsQueries.updateValidationResult")(
        function* ({ id, data }: { id: number; data: Partial<NewValidationResult> }) {
          const [result] = yield* db
            .update(validationResults)
            .set(data)
            .where(eq(validationResults.id, id))
            .returning()

          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to update validation result",
              })
            )
          }
          return result
        }
      )

      const createParticipantVerification = Effect.fn(
        "ValidationsQueries.createParticipantVerification"
      )(function* ({ data }: { data: NewParticipantVerification }) {
        const [result] = yield* db.insert(participantVerifications).values(data).returning()

        if (!result) {
          return yield* Effect.fail(
            new SqlError({
              cause: "Failed to create participant verification",
            })
          )
        }

        return result
      })

      const clearNonEnabledRuleResults = Effect.fn("ValidationsQueries.clearNonEnabledRuleResults")(
        function* ({ participantId, ruleKeys }: { participantId: number; ruleKeys: string[] }) {
          yield* db
            .delete(validationResults)
            .where(
              and(
                eq(validationResults.participantId, participantId),
                notInArray(validationResults.ruleKey, ruleKeys)
              )
            )
        }
      )

      const getAllParticipantVerifications = Effect.fn(
        "ValidationsQueries.getAllParticipantVerifications"
      )(function* ({
        domain,
        page,
        pageSize,
        search,
      }: {
        domain: string
        page: number
        pageSize: number
        search?: string
      }) {
        const offset = (page - 1) * pageSize

        const allVerifications = yield* db.query.participantVerifications.findMany({
          with: {
            participant: {
              with: {
                competitionClass: true,
                deviceGroup: true,
                validationResults: true,
                submissions: true,
                marathon: true,
              },
            },
          },
          orderBy: (participantVerifications, { desc }) => [
            desc(participantVerifications.createdAt),
          ],
        })

        let filteredVerifications = allVerifications.filter(
          (v) => v.participant.marathon.domain === domain
        )

        if (search) {
          const lowerSearch = search.toLowerCase()
          filteredVerifications = filteredVerifications.filter((v) =>
            v.participant.reference.toLowerCase().includes(lowerSearch)
          )
        }

        const totalCount = filteredVerifications.length

        const paginatedResults = filteredVerifications
          .slice(offset, offset + pageSize)
          .map((v) => ({
            ...v,
            participant: { ...v.participant, marathon: undefined },
          }))

        return {
          data: paginatedResults,
          totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize),
        }
      })

      const clearAllValidationResults = Effect.fn("ValidationsQueries.clearAllValidationResults")(
        function* ({ participantId }: { participantId: number }) {
          yield* db
            .delete(validationResults)
            .where(eq(validationResults.participantId, participantId))
        }
      )

      return {
        getValidationResultsByParticipantId,
        getValidationResultsByDomain,
        getParticipantVerificationsByStaffId,
        createValidationResult,
        createMultipleValidationResults,
        updateValidationResult,
        createParticipantVerification,
        clearNonEnabledRuleResults,
        getAllParticipantVerifications,
        clearAllValidationResults,
      }
    }),
  }
) {}
