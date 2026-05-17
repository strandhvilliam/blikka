import { Effect, Layer, Context } from 'effect'
import { DrizzleClient } from '../drizzle-client'
import { and, notInArray, eq } from 'drizzle-orm'
import { participantVerifications, validationResults } from '../schema'
import type {
  CompetitionClass,
  DeviceGroup,
  NewParticipantVerification,
  NewValidationResult,
  Participant,
  ParticipantVerification,
  Submission,
  Topic,
  ValidationResult,
} from '../types'
import { DbError } from '../utils'

type DomainSubmissionValidationRow = Submission & {
  participant: Participant
  globalValidationResults: ValidationResult[]
  validationResults: ValidationResult[]
}

type ParticipantVerificationParticipantBase = Participant & {
  marathon: undefined
  submissions: Submission[]
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  validationResults: ValidationResult[]
}

type ParticipantVerificationListItem = ParticipantVerification & {
  participant: ParticipantVerificationParticipantBase
}

type ParticipantVerificationByReferenceParticipant = Participant & {
  marathon: undefined
  submissions: Array<Submission & { topic: Topic }>
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  validationResults: ValidationResult[]
}

type ParticipantVerificationByReferenceRow = ParticipantVerification & {
  participant: ParticipantVerificationByReferenceParticipant
}

export class ValidationsRepository extends Context.Service<
  ValidationsRepository,
  {
    /** Validation results for a participant. */
    readonly getValidationResultsByParticipantId: (params: {
      participantId: number
    }) => Effect.Effect<ValidationResult[], DbError>
    /** Validation results for the marathon identified by domain. */
    readonly getValidationResultsByDomain: (params: {
      domain: string
    }) => Effect.Effect<DomainSubmissionValidationRow[], DbError>
    /** Participant verification rows created by a staff user. */
    readonly getParticipantVerificationsByStaffId: (params: {
      staffId: string
      domain: string
      cursor?: number
      limit?: number
    }) => Effect.Effect<
      {
        items: ParticipantVerificationListItem[]
        nextCursor: number | undefined
      },
      DbError
    >
    /** Insert a validation result row. */
    readonly createValidationResult: (params: {
      data: NewValidationResult
    }) => Effect.Effect<ValidationResult, DbError>
    /** Insert multiple validation result rows. */
    readonly createMultipleValidationResults: (params: {
      domain: string
      reference: string
      data: Omit<NewValidationResult, 'participantId'>[]
    }) => Effect.Effect<ValidationResult[], DbError>
    /** Patch fields on a validation result identified by id. */
    readonly updateValidationResult: (params: {
      id: number
      data: Partial<NewValidationResult>
    }) => Effect.Effect<ValidationResult, DbError>
    /** Insert a participant verification row. */
    readonly createParticipantVerification: (params: {
      data: NewParticipantVerification
    }) => Effect.Effect<ParticipantVerification, DbError>
    /** Delete validation results for rules that are no longer enabled. */
    readonly clearNonEnabledRuleResults: (params: {
      participantId: number
      ruleKeys: string[]
    }) => Effect.Effect<void, DbError>
    /** Participant verifications for a marathon domain with optional filters. */
    readonly getAllParticipantVerifications: (params: {
      domain: string
      page: number
      pageSize: number
      search?: string
    }) => Effect.Effect<
      {
        data: ParticipantVerificationListItem[]
        totalCount: number
        page: number
        pageSize: number
        totalPages: number
      },
      DbError
    >
    /** Participant verification by reference/domain, or null if missing. */
    readonly getParticipantVerificationByReference: (params: {
      domain: string
      reference: string
    }) => Effect.Effect<ParticipantVerificationByReferenceRow | null, DbError>
    /** Delete all validation results for a participant. */
    readonly clearAllValidationResults: (params: {
      participantId: number
    }) => Effect.Effect<void, DbError>
  }
>()('@blikka/db/validations-repository') {}

const makeValidationsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const getValidationResultsByParticipantId: ValidationsRepository['Service']['getValidationResultsByParticipantId'] =
    Effect.fn('ValidationsRepository.getValidationResultsByParticipantId')(function* ({
      participantId,
    }: {
      participantId: number
    }) {
      const result = yield* use((db) =>
        db.query.validationResults.findMany({
          where: (table, operators) => operators.eq(table.participantId, participantId),
        }),
      )
      return result
    })

  const getValidationResultsByDomain: ValidationsRepository['Service']['getValidationResultsByDomain'] =
    Effect.fn('ValidationsRepository.getValidationResultsByDomain')(function* ({
      domain,
    }: {
      domain: string
    }) {
      const result = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
          with: {
            participants: {
              with: { submissions: true, validationResults: true },
            },
          },
        }),
      )
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

  const getParticipantVerificationsByStaffId: ValidationsRepository['Service']['getParticipantVerificationsByStaffId'] =
    Effect.fn('ValidationsRepository.getParticipantVerificationsByStaffId')(function* ({
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
      const result = yield* use((db) =>
        db.query.participantVerifications.findMany({
          where: (table, operators) =>
            cursor
              ? operators.and(operators.eq(table.staffId, staffId), operators.lt(table.id, cursor))
              : operators.eq(table.staffId, staffId),
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
        }),
      )
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

  const createValidationResult: ValidationsRepository['Service']['createValidationResult'] =
    Effect.fn('ValidationsRepository.createValidationResult')(function* ({
      data,
    }: {
      data: NewValidationResult
    }) {
      const [result] = yield* use((db) => db.insert(validationResults).values(data).returning())
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to create validation result',
          }),
        )
      }
      return result
    })

  const createMultipleValidationResults: ValidationsRepository['Service']['createMultipleValidationResults'] =
    Effect.fn('ValidationsRepository.createMultipleValidationResults')(function* ({
      data,
      domain,
      reference,
    }: {
      domain: string
      reference: string
      data: Omit<NewValidationResult, 'participantId'>[]
    }) {
      const participant = yield* use((db) =>
        db.query.participants.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.domain, domain),
              operators.eq(table.reference, reference),
            ),
        }),
      )
      if (!participant) {
        return yield* Effect.fail(
          new DbError({
            message: 'Participant not found',
          }),
        )
      }
      const existingValidationResults = yield* use((db) =>
        db.query.validationResults.findMany({
          where: (table, operators) => operators.eq(table.participantId, participant.id),
        }),
      )
      const existingValidationResultsMap = new Map(
        existingValidationResults.map((r) => [
          r.fileName
            ? `${r.participantId}-${r.fileName}-${r.ruleKey}`
            : `${r.participantId}-${r.ruleKey}`,
          r,
        ]),
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
        },
      )
      const result: ValidationResult[] = []
      if (toCreate.length > 0) {
        const created = yield* use((db) =>
          db.insert(validationResults).values(toCreate).returning(),
        )
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

  const updateValidationResult: ValidationsRepository['Service']['updateValidationResult'] =
    Effect.fn('ValidationsRepository.updateValidationResult')(function* ({
      id,
      data,
    }: {
      id: number
      data: Partial<NewValidationResult>
    }) {
      const [result] = yield* use((db) =>
        db.update(validationResults).set(data).where(eq(validationResults.id, id)).returning(),
      )
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to update validation result',
          }),
        )
      }
      return result
    })

  const createParticipantVerification: ValidationsRepository['Service']['createParticipantVerification'] =
    Effect.fn('ValidationsRepository.createParticipantVerification')(function* ({
      data,
    }: {
      data: NewParticipantVerification
    }) {
      const [result] = yield* use((db) =>
        db.insert(participantVerifications).values(data).returning(),
      )
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to create participant verification',
          }),
        )
      }
      return result
    })

  const clearNonEnabledRuleResults: ValidationsRepository['Service']['clearNonEnabledRuleResults'] =
    Effect.fn('ValidationsRepository.clearNonEnabledRuleResults')(function* ({
      participantId,
      ruleKeys,
    }: {
      participantId: number
      ruleKeys: string[]
    }) {
      yield* use((db) =>
        db
          .delete(validationResults)
          .where(
            and(
              eq(validationResults.participantId, participantId),
              notInArray(validationResults.ruleKey, ruleKeys),
            ),
          ),
      )
    })

  const getAllParticipantVerifications: ValidationsRepository['Service']['getAllParticipantVerifications'] =
    Effect.fn('ValidationsRepository.getAllParticipantVerifications')(function* ({
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
      const allVerifications = yield* use((db) =>
        db.query.participantVerifications.findMany({
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
        }),
      )
      let filteredVerifications = allVerifications.filter(
        (v) => v.participant.marathon.domain === domain,
      )
      if (search) {
        const lowerSearch = search.toLowerCase()
        filteredVerifications = filteredVerifications.filter((v) =>
          v.participant.reference.toLowerCase().includes(lowerSearch),
        )
      }
      const totalCount = filteredVerifications.length
      const paginatedResults = filteredVerifications.slice(offset, offset + pageSize).map((v) => ({
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

  const getParticipantVerificationByReference: ValidationsRepository['Service']['getParticipantVerificationByReference'] =
    Effect.fn('ValidationsRepository.getParticipantVerificationByReference')(function* ({
      domain,
      reference,
    }: {
      domain: string
      reference: string
    }) {
      const allVerifications = yield* use((db) =>
        db.query.participantVerifications.findMany({
          with: {
            participant: {
              with: {
                competitionClass: true,
                deviceGroup: true,
                validationResults: true,
                submissions: {
                  with: {
                    topic: true,
                  },
                },
                marathon: true,
              },
            },
          },
          orderBy: (participantVerifications, { desc }) => [
            desc(participantVerifications.createdAt),
          ],
        }),
      )
      const match = allVerifications.find(
        (verification) =>
          verification.participant.marathon.domain === domain &&
          verification.participant.reference === reference,
      )
      return match
        ? {
            ...match,
            participant: {
              ...match.participant,
              marathon: undefined,
            },
          }
        : null
    })

  const clearAllValidationResults: ValidationsRepository['Service']['clearAllValidationResults'] =
    Effect.fn('ValidationsRepository.clearAllValidationResults')(function* ({
      participantId,
    }: {
      participantId: number
    }) {
      yield* use((db) =>
        db.delete(validationResults).where(eq(validationResults.participantId, participantId)),
      )
    })

  return ValidationsRepository.of({
    getValidationResultsByParticipantId,
    getValidationResultsByDomain,
    getParticipantVerificationsByStaffId,
    createValidationResult,
    createMultipleValidationResults,
    updateValidationResult,
    createParticipantVerification,
    clearNonEnabledRuleResults,
    getAllParticipantVerifications,
    getParticipantVerificationByReference,
    clearAllValidationResults,
  })
})

export const ValidationsRepositoryLayerNoDeps = Layer.effect(
  ValidationsRepository,
  makeValidationsRepository,
)

export const ValidationsRepositoryLayer = ValidationsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
