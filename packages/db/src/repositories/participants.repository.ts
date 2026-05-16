import { Effect, Layer, Option, Context } from "effect"
import { DrizzleClient } from "../drizzle-client"
import {
  participants,
  participantTermsAcceptances,
  submissions,
  validationResults,
  votingRound,
  votingRoundVote,
  votingSession,
} from "../schema"
import { eq, and, or, inArray, gt, lt, ilike, notInArray, isNotNull, count, sql } from "drizzle-orm"
import type {
  CompetitionClass,
  ContactSheet,
  DeviceGroup,
  NewParticipant,
  NewParticipantTermsAcceptance,
  Participant,
  ParticipantTermsAcceptance,
  Submission,
  Topic,
  ValidationResult,
  ZippedSubmission,
} from "../types"
import { DbError } from "../utils"
import { VALIDATION_OUTCOME } from "@blikka/validation"

/** Participant from `getParticipantById` with nested relations. */
type ParticipantWithSubmissionsAndRelations = Participant & {
  submissions: Submission[]
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  zippedSubmissions: ZippedSubmission[]
  validationResults: ValidationResult[]
}

/** Participant from reference / by-camera lookups with topic on each submission. */
type ParticipantWithTopicSubmissionsAndContactSheets = Participant & {
  submissions: (Submission & { topic: Topic })[]
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  zippedSubmissions: ZippedSubmission[]
  validationResults: ValidationResult[]
  contactSheets: ContactSheet[]
}

type ValidationSeverityCounts = { errors: number; warnings: number }

type InfiniteParticipantsRoundVote = {
  votedAt: string
  round: { topicId: number; roundNumber: number }
}

type InfiniteParticipantsVotingSessionRow = {
  votedAt: string | null
  createdAt: string
  token: string
  topicId: number
  roundVotes: InfiniteParticipantsRoundVote[]
}

/** Base row for domain participant list (phone hash omitted in query). */
type ParticipantDomainListBase = Omit<Participant, "phoneHash"> & {
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
}

type InfiniteDomainParticipantRow = ParticipantDomainListBase & {
  activeTopicSubmissionId: number | null
  activeTopicSubmissionCreatedAt: string | null
  submissionHealth: { hasExif: boolean; hasThumbnail: boolean } | null
  votingSession: InfiniteParticipantsVotingSessionRow | null
  zipKeys: string[]
  contactSheetKeys: string[]
  failedValidationResults: ValidationSeverityCounts
  passedValidationResults: ValidationSeverityCounts
  skippedValidationResults: ValidationSeverityCounts
}

type InfiniteParticipantsPage = {
  participants: InfiniteDomainParticipantRow[]
  nextCursor: string | null
}

type DashboardRecentParticipant = Pick<
  Participant,
  "id" | "reference" | "firstname" | "lastname" | "status"
> & {
  updatedAt: string
  validationIssueCount: number
}

export class ParticipantsRepository extends Context.Service<
  ParticipantsRepository,
  {
  /** Participant row by primary key with related data, or none if missing. */
  readonly getParticipantById: (params: {
    id: number
  }) => Effect.Effect<Option.Option<ParticipantWithSubmissionsAndRelations>, DbError>
  /** Participant row by reference/domain with related data, or none if missing. */
  readonly getParticipantByReference: (params: {
    reference: string
    domain: string
  }) => Effect.Effect<
    Option.Option<ParticipantWithTopicSubmissionsAndContactSheets>,
    DbError
  >
  /** By-camera participant lookup by phone hash, or none if missing. */
  readonly getByPhoneHashForByCamera: (params: {
    marathonId: number
    phoneHash: string
  }) => Effect.Effect<
    Option.Option<ParticipantWithTopicSubmissionsAndContactSheets>,
    DbError
  >
  /** Paginated participants for a marathon domain with filters and sort options. */
  readonly getInfiniteParticipantsByDomain: (params: {
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
    includeStatuses?: string[]
    hasValidationErrors?: boolean
    votedFilter?: "voted" | "not-voted"
  }) => Effect.Effect<InfiniteParticipantsPage, DbError>
  /** Dashboard counts for participants in a marathon domain. */
  readonly getDashboardOverview: (params: { domain: string }) => Effect.Effect<
    {
      totalParticipants: number
      statusCounts: {
        prepared: number
        initialized: number
        completed: number
        verified: number
      }
      uploadedCount: number
      validationIssueCount: number
      recentParticipants: DashboardRecentParticipant[]
    },
    DbError
  >
  /** Insert a new participant row. */
  readonly createParticipant: (params: {
    data: NewParticipant
  }) => Effect.Effect<Participant, DbError>
  /** Insert a participant terms acceptance row. */
  readonly createTermsAcceptance: (params: {
    data: NewParticipantTermsAcceptance
  }) => Effect.Effect<Option.Option<ParticipantTermsAcceptance>, DbError>
  /** Patch fields on a participant identified by id. */
  readonly updateParticipantById: (params: {
    id: number
    data: Partial<NewParticipant>
  }) => Effect.Effect<Participant, DbError>
  /** Patch fields on a participant identified by reference/domain. */
  readonly updateParticipantByReference: (params: {
    reference: string
    domain: string
    data: Partial<NewParticipant>
  }) => Effect.Effect<{ id: number }, DbError>
  /** Delete a participant by id. */
  readonly deleteParticipant: (params: {
    id: number
  }) => Effect.Effect<Participant, DbError>
  /** Delete participants by id scoped to a domain. */
  readonly batchDeleteParticipants: (params: {
    ids: number[]
    domain: string
  }) => Effect.Effect<{ deletedCount: number; failedIds: number[] }, DbError>
  /** Mark participants verified by id scoped to a domain. */
  readonly batchVerifyParticipants: (params: {
    ids: number[]
    domain: string
  }) => Effect.Effect<{ updatedCount: number; failedIds: number[] }, DbError>
  /** Mark participants completed by id scoped to a domain. */
  readonly batchMarkParticipantsCompleted: (params: {
    ids: number[]
    domain: string
  }) => Effect.Effect<{ updatedCount: number; failedIds: number[] }, DbError>
}
>()("@blikka/db/participants-repository") {}

const makeParticipantsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient
  const getParticipantById: ParticipantsRepository["Service"]["getParticipantById"] = Effect.fn(
    "ParticipantsRepository.getParticipantByIdQuery",
  )(function* ({ id }) {
    const result = yield* use((db) =>
      db.query.participants.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
        with: {
          submissions: true,
          competitionClass: true,
          deviceGroup: true,
          validationResults: true,
          zippedSubmissions: true,
        },
      }),
    )
    return Option.fromNullishOr(result)
  })
  const getParticipantByReference: ParticipantsRepository["Service"]["getParticipantByReference"] =
    Effect.fn("ParticipantsRepository.getParticipantByReferenceQuery")(function* ({
      reference,
      domain,
    }) {
      const result = yield* use((db) =>
        db.query.participants.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.reference, reference),
              operators.eq(table.domain, domain),
            ),
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
        }),
      )
      return Option.fromNullishOr(result)
    })
  const getByPhoneHashForByCamera: ParticipantsRepository["Service"]["getByPhoneHashForByCamera"] =
    Effect.fn("ParticipantsRepository.getByPhoneHashForByCameraQuery")(function* ({
      marathonId,
      phoneHash,
    }) {
      const result = yield* use((db) =>
        db.query.participants.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.marathonId, marathonId),
              operators.eq(table.participantMode, "by-camera"),
              operators.eq(table.phoneHash, phoneHash),
            ),
          orderBy: (table, operators) => [
            operators.desc(table.updatedAt),
            operators.desc(table.id),
          ],
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
        }),
      )
      return Option.fromNullishOr(result)
    })
  const getInfiniteParticipantsByDomain: ParticipantsRepository["Service"]["getInfiniteParticipantsByDomain"] =
    Effect.fn("ParticipantsRepository.getInfiniteParticipantsByDomainQuery")(function* ({
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
      includeStatuses,
      hasValidationErrors,
      votedFilter,
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
          baseConditions.push(inArray(participants.competitionClassId, [...competitionClassId]))
        } else {
          baseConditions.push(eq(participants.competitionClassId, competitionClassId as number))
        }
      }
      if (deviceGroupId !== undefined) {
        if (Array.isArray(deviceGroupId)) {
          baseConditions.push(inArray(participants.deviceGroupId, [...deviceGroupId]))
        } else {
          baseConditions.push(eq(participants.deviceGroupId, deviceGroupId as number))
        }
      }
      if (search && search.trim().length > 0) {
        const searchPattern = `%${search.trim()}%`
        baseConditions.push(
          or(
            ilike(participants.reference, searchPattern),
            ilike(participants.firstname, searchPattern),
            ilike(participants.lastname, searchPattern),
            ilike(participants.email, searchPattern),
          )!,
        )
      }
      if (statusFilter) {
        baseConditions.push(eq(participants.status, statusFilter))
      }
      if (excludeStatuses && excludeStatuses.length > 0) {
        baseConditions.push(notInArray(participants.status, excludeStatuses))
      }
      if (includeStatuses && includeStatuses.length > 0) {
        baseConditions.push(inArray(participants.status, [...includeStatuses]))
      }
      if (hasValidationErrors) {
        const participantsWithErrors = yield* use((db) =>
          db
            .selectDistinct({
              participantId: validationResults.participantId,
            })
            .from(validationResults)
            .innerJoin(participants, eq(participants.id, validationResults.participantId))
            .where(
              and(
                eq(participants.domain, domain),
                eq(validationResults.outcome, VALIDATION_OUTCOME.FAILED),
                or(
                  eq(validationResults.severity, "error"),
                  eq(validationResults.severity, "warning"),
                ),
              ),
            ),
        )
        const participantIdsWithErrors = participantsWithErrors.map((p) => p.participantId)
        if (participantIdsWithErrors.length === 0) {
          return {
            participants: [],
            nextCursor: null,
          }
        }
        baseConditions.push(inArray(participants.id, participantIdsWithErrors))
      }
      if (topicId !== undefined) {
        const participantsWithTopicSubmissions = yield* use((db) =>
          db
            .selectDistinct({ participantId: submissions.participantId })
            .from(submissions)
            .innerJoin(participants, eq(participants.id, submissions.participantId))
            .where(and(eq(participants.domain, domain), eq(submissions.topicId, topicId))),
        )
        const participantIdsWithTopicSubmissions = participantsWithTopicSubmissions.map(
          (p) => p.participantId,
        )
        if (participantIdsWithTopicSubmissions.length === 0) {
          return {
            participants: [],
            nextCursor: null,
          }
        }
        baseConditions.push(inArray(participants.id, participantIdsWithTopicSubmissions))
      }
      if ((votedFilter === "voted" || votedFilter === "not-voted") && topicId !== undefined) {
        const participantsWhoVoted = yield* use((db) =>
          db
            .selectDistinct({
              participantId: votingSession.connectedParticipantId,
            })
            .from(votingRoundVote)
            .innerJoin(votingSession, eq(votingSession.id, votingRoundVote.sessionId))
            .innerJoin(participants, eq(participants.id, votingSession.connectedParticipantId))
            .innerJoin(votingRound, eq(votingRound.id, votingRoundVote.roundId))
            .where(
              and(
                eq(participants.domain, domain),
                eq(votingSession.topicId, topicId),
                eq(
                  votingRoundVote.roundId,
                  sql`(
                      select vr.id
                      from voting_round vr
                      where vr.topic_id = ${topicId}
                      order by vr.round_number desc, vr.id desc
                      limit 1
                    )`,
                ),
              ),
            ),
        )
        const participantIdsWhoVoted = participantsWhoVoted
          .map((p) => p.participantId)
          .filter((id): id is number => id !== null)
        if (votedFilter === "voted") {
          if (participantIdsWhoVoted.length === 0) {
            return {
              participants: [],
              nextCursor: null,
            }
          }
          baseConditions.push(inArray(participants.id, participantIdsWhoVoted))
        } else {
          if (participantIdsWhoVoted.length > 0) {
            baseConditions.push(notInArray(participants.id, participantIdsWhoVoted))
          }
        }
      }
      const whereCondition =
        baseConditions.length === 1 ? baseConditions[0] : and(...baseConditions)
      const participant = yield* use((db) =>
        db.query.participants.findMany({
          where: whereCondition,
          columns: {
            phoneHash: false,
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
                      thumbnailKey: true,
                      exif: true,
                    },
                    where: (table, operators) => operators.eq(table.topicId, topicId),
                  },
                }
              : {}),
            validationResults: true,
            votingSessions: {
              columns: {
                token: true,
                topicId: true,
                createdAt: true,
              },
              with: {
                roundVotes: {
                  columns: {
                    votedAt: true,
                  },
                  with: {
                    round: {
                      columns: {
                        topicId: true,
                        roundNumber: true,
                      },
                    },
                  },
                },
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
          orderBy: (table, operators) =>
            sortOrder === "desc" ? operators.desc(table.id) : operators.asc(table.id),
        }),
      )
      function countValidationResults(
        validations: {
          outcome: string
          severity: string
        }[],
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
        const lastParticipant = participantsToReturn[participantsToReturn.length - 1]
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
          const latestTopicSubmission =
            topicId === undefined
              ? null
              : (participantSubmissions.sort(
                  (left, right) =>
                    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
                )[0] ?? null)
          const activeTopicSubmissionId =
            topicId === undefined ? null : (latestTopicSubmission?.id ?? null)
          const activeTopicSubmissionCreatedAt =
            topicId === undefined ? null : (latestTopicSubmission?.createdAt ?? null)
          return {
            ...rest,
            activeTopicSubmissionId,
            activeTopicSubmissionCreatedAt,
            submissionHealth:
              topicId === undefined
                ? null
                : {
                    hasExif:
                      latestTopicSubmission?.exif !== null &&
                      latestTopicSubmission?.exif !== undefined &&
                      Object.keys(latestTopicSubmission.exif).length > 0,
                    hasThumbnail: latestTopicSubmission?.thumbnailKey !== null,
                  },
            votingSession:
              votingSessions
                .filter((session) => (topicId !== undefined ? session.topicId === topicId : true))
                .sort(
                  (left, right) =>
                    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
                )
                .map((session) => {
                  const latestRoundVote =
                    session.roundVotes
                      .filter((roundVote) =>
                        topicId !== undefined ? roundVote.round?.topicId === topicId : true,
                      )
                      .sort((left, right) => {
                        const leftRoundNumber = left.round?.roundNumber ?? 0
                        const rightRoundNumber = right.round?.roundNumber ?? 0
                        return rightRoundNumber - leftRoundNumber
                      })[0] ?? null

                  return {
                    ...session,
                    votedAt: latestRoundVote?.votedAt ?? null,
                  }
                })[0] ?? null,
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
  const getDashboardOverview: ParticipantsRepository["Service"]["getDashboardOverview"] = Effect.fn(
    "ParticipantsRepository.getDashboardOverview",
  )(function* ({ domain }) {
    const [statusRows, participantsWithValidationIssues, recentParticipants] = yield* Effect.all([
      use((db) =>
        db
          .select({
            status: participants.status,
            count: count(),
          })
          .from(participants)
          .where(eq(participants.domain, domain))
          .groupBy(participants.status),
      ),
      use((db) =>
        db
          .selectDistinct({
            participantId: validationResults.participantId,
          })
          .from(validationResults)
          .innerJoin(participants, eq(participants.id, validationResults.participantId))
          .where(
            and(
              eq(participants.domain, domain),
              eq(validationResults.outcome, VALIDATION_OUTCOME.FAILED),
              or(
                eq(validationResults.severity, "error"),
                eq(validationResults.severity, "warning"),
              ),
            ),
          ),
      ),
      use((db) =>
        db.query.participants.findMany({
          where: (table, operators) => operators.eq(table.domain, domain),
          columns: {
            id: true,
            reference: true,
            firstname: true,
            lastname: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          with: {
            validationResults: {
              columns: {
                outcome: true,
                severity: true,
              },
            },
          },
          orderBy: (table, operators) => [
            operators.desc(table.updatedAt),
            operators.desc(table.createdAt),
            operators.desc(table.id),
          ],
          limit: 6,
        }),
      ),
    ])

    const statusCounts = {
      prepared: 0,
      initialized: 0,
      completed: 0,
      verified: 0,
    }

    for (const row of statusRows) {
      if (row.status === "prepared") statusCounts.prepared = row.count
      if (row.status === "initialized") statusCounts.initialized = row.count
      if (row.status === "completed") statusCounts.completed = row.count
      if (row.status === "verified") statusCounts.verified = row.count
    }

    return {
      totalParticipants: statusRows.reduce((total, row) => total + row.count, 0),
      statusCounts,
      uploadedCount: statusCounts.completed + statusCounts.verified,
      validationIssueCount: participantsWithValidationIssues.length,
      recentParticipants: recentParticipants.map((participant) => ({
        id: participant.id,
        reference: participant.reference,
        firstname: participant.firstname,
        lastname: participant.lastname,
        status: participant.status,
        updatedAt: participant.updatedAt ?? participant.createdAt,
        validationIssueCount: participant.validationResults.filter(
          (validation) =>
            validation.outcome === VALIDATION_OUTCOME.FAILED &&
            (validation.severity === "error" || validation.severity === "warning"),
        ).length,
      })),
    }
  })
  const createParticipant: ParticipantsRepository["Service"]["createParticipant"] = Effect.fn(
    "ParticipantsRepository.createParticipantMutation",
  )(function* ({ data }) {
    if (!data.domain) {
      return yield* Effect.fail(
        new DbError({
          message: "Domain is required",
        }),
      )
    }
    const [result] = yield* use((db) => db.insert(participants).values(data).returning())
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to create participant",
        }),
      )
    }
    return result
  })

  const updateParticipantById: ParticipantsRepository["Service"]["updateParticipantById"] =
    Effect.fn("ParticipantsRepository.updateParticipantMutation")(function* ({ id, data }) {
      const [result] = yield* use((db) =>
        db.update(participants).set(data).where(eq(participants.id, id)).returning(),
      )
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: "Failed to update participant",
          }),
        )
      }
      return result
    })

  const updateParticipantByReference: ParticipantsRepository["Service"]["updateParticipantByReference"] =
    Effect.fn("ParticipantsRepository.updateParticipantByReference")(function* ({
      reference,
      domain,
      data,
    }) {
      const [result] = yield* use((db) =>
        db
          .update(participants)
          .set(data)
          .where(and(eq(participants.reference, reference), eq(participants.domain, domain)))
          .returning({ id: participants.id }),
      )
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: "Failed to update participant",
          }),
        )
      }
      return result
    })
  const createTermsAcceptance: ParticipantsRepository["Service"]["createTermsAcceptance"] =
    Effect.fn("ParticipantsRepository.createTermsAcceptance")(function* ({ data }) {
      const [result] = yield* use((db) =>
        db.insert(participantTermsAcceptances).values(data).onConflictDoNothing().returning(),
      )
      return Option.fromNullishOr(result)
    })
  const deleteParticipant: ParticipantsRepository["Service"]["deleteParticipant"] = Effect.fn(
    "ParticipantsRepository.deleteParticipantMutation",
  )(function* ({ id }: { id: number }) {
    const [result] = yield* use((db) =>
      db.delete(participants).where(eq(participants.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: "Failed to delete participant",
        }),
      )
    }
    return result
  })
  const batchDeleteParticipants: ParticipantsRepository["Service"]["batchDeleteParticipants"] =
    Effect.fn("ParticipantsRepository.batchDeleteParticipants")(function* ({ ids, domain }) {
      if (ids.length === 0) {
        return { deletedCount: 0, failedIds: [] }
      }
      const results = yield* use((db) =>
        db
          .delete(participants)
          .where(and(eq(participants.domain, domain), inArray(participants.id, ids)))
          .returning({ id: participants.id }),
      )
      const deletedIds = results.map((r) => r.id)
      const failedIds = ids.filter((id) => !deletedIds.includes(id))
      return {
        deletedCount: deletedIds.length,
        failedIds,
      }
    })
  const batchVerifyParticipants: ParticipantsRepository["Service"]["batchVerifyParticipants"] =
    Effect.fn("ParticipantsRepository.batchVerifyParticipants")(function* ({ ids, domain }) {
      if (ids.length === 0) {
        return { updatedCount: 0, failedIds: [] }
      }
      const results = yield* use((db) =>
        db
          .update(participants)
          .set({ status: "verified" })
          .where(
            and(
              eq(participants.domain, domain),
              inArray(participants.id, ids),
              eq(participants.status, "completed"),
            ),
          )
          .returning({ id: participants.id }),
      )
      const updatedIds = results.map((r) => r.id)
      const failedIds = ids.filter((id) => !updatedIds.includes(id))
      return {
        updatedCount: updatedIds.length,
        failedIds,
      }
    })
  const batchMarkParticipantsCompleted: ParticipantsRepository["Service"]["batchMarkParticipantsCompleted"] =
    Effect.fn("ParticipantsRepository.batchMarkParticipantsCompleted")(function* ({ ids, domain }) {
      if (ids.length === 0) {
        return { updatedCount: 0, failedIds: [] }
      }
      const results = yield* use((db) =>
        db
          .update(participants)
          .set({ status: "completed" })
          .where(
            and(
              eq(participants.domain, domain),
              inArray(participants.id, ids),
              notInArray(participants.status, ["completed", "verified"]),
            ),
          )
          .returning({ id: participants.id }),
      )
      const updatedIds = results.map((r) => r.id)
      const failedIds = ids.filter((id) => !updatedIds.includes(id))
      return {
        updatedCount: updatedIds.length,
        failedIds,
      }
    })
  return ParticipantsRepository.of({
    getParticipantById,
    getParticipantByReference,
    getByPhoneHashForByCamera,
    getInfiniteParticipantsByDomain,
    getDashboardOverview,
    createParticipant,
    createTermsAcceptance,
    updateParticipantById,
    updateParticipantByReference,
    deleteParticipant,
    batchDeleteParticipants,
    batchVerifyParticipants,
    batchMarkParticipantsCompleted,
  })
})

export const ParticipantsRepositoryLayerNoDeps = Layer.effect(
  ParticipantsRepository,
  makeParticipantsRepository,
)

export const ParticipantsRepositoryLayer = ParticipantsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
