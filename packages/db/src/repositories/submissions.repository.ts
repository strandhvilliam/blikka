import { Effect, Layer, Option, Context } from 'effect'
import { DrizzleClient } from '../drizzle-client'
import { participants, submissions, zippedSubmissions } from '../schema'
import { eq, inArray } from 'drizzle-orm'
import type {
  CompetitionClass,
  DeviceGroup,
  NewSubmission,
  NewZippedSubmission,
  Participant,
  Submission,
  Topic,
  ZippedSubmission,
} from '../types'
import { DbError } from '../utils'
import { conflictUpdateSetAllColumns } from '../utils'
interface SubmissionKeys extends Pick<Submission, 'key' | 'thumbnailKey' | 'previewKey'> {}

interface SubmissionVoteRealtimePayload {
  submissionId: number
  submissionCreatedAt: string
  submissionKey: string
  submissionThumbnailKey: string | null
  participantReference: string
  participantFirstName: string
  participantLastName: string
}

interface SubmissionsForJuryQuery extends Submission {
  topic: Topic
  participant: Participant & {
    competitionClass: CompetitionClass | null
    deviceGroup: DeviceGroup | null
  }
}

export class SubmissionsRepository extends Context.Service<
  SubmissionsRepository,
  {
    /** Storage keys for all submissions in a marathon. */
    readonly getAllSubmissionKeysForMarathon: (params: {
      marathonId: number
    }) => Effect.Effect<SubmissionKeys[], DbError>
    /** Submission row by primary key, or none if missing. */
    readonly getSubmissionById: (params: {
      id: number
    }) => Effect.Effect<Option.Option<Submission>, DbError>
    /** Submission payload used for realtime vote notifications, or none if missing. */
    readonly getSubmissionVoteRealtimePayloadById: (params: {
      id: number
    }) => Effect.Effect<Option.Option<SubmissionVoteRealtimePayload>, DbError>
    /** Submission row by storage key, or none if missing. */
    readonly getSubmissionByKey: (params: {
      key: string
    }) => Effect.Effect<Option.Option<Submission>, DbError>
    /** Latest zipped submissions per participant for a marathon domain. */
    readonly getZippedSubmissionsByDomain: (params: {
      domain: string
    }) => Effect.Effect<ZippedSubmission[], DbError>
    /** Zipped submissions belonging to a marathon. */
    readonly getZippedSubmissionsByMarathonId: (params: {
      marathonId: number
    }) => Effect.Effect<ZippedSubmission[], DbError>
    /** Submission rows matching any of the provided storage keys. */
    readonly getManySubmissionsByKeys: (params: {
      keys: string[]
    }) => Effect.Effect<Submission[], DbError>
    /** Submission rows belonging to a participant. */
    readonly getSubmissionsByParticipantId: (params: {
      participantId: number
    }) => Effect.Effect<Submission[], DbError>
    /** Submission row for a participant/topic pair, or none if missing. */
    readonly getSubmissionByParticipantIdAndTopicId: (params: {
      participantId: number
      topicId: number
    }) => Effect.Effect<Option.Option<Submission>, DbError>
    /** Jury submission query with participant, class, group, and topic data. */
    readonly getSubmissionsForJuryQuery: (params: {
      filters: {
        domain: string
        competitionClassId?: number | null
        deviceGroupId?: number | null
        topicId?: number | null
      }
    }) => Effect.Effect<SubmissionsForJuryQuery[], DbError>
    /** Insert a new submission row. */
    readonly createSubmission: (params: {
      data: NewSubmission
    }) => Effect.Effect<Submission, DbError>
    /** Insert multiple submission rows. */
    readonly createMultipleSubmissions: (params: {
      data: NewSubmission[]
    }) => Effect.Effect<Submission[], DbError>
    /** Patch a submission identified by storage key. */
    readonly updateSubmissionByKey: (params: {
      key: string
      data: Partial<NewSubmission>
    }) => Effect.Effect<Submission, DbError>
    /** Patch a submission identified by id. */
    readonly updateSubmissionById: (params: {
      id: number
      data: Partial<NewSubmission>
    }) => Effect.Effect<Submission, DbError>
    /** Insert a new zipped submission row. */
    readonly createZippedSubmission: (params: {
      data: NewZippedSubmission
    }) => Effect.Effect<ZippedSubmission, DbError>
    /** Patch a zipped submission identified by id. */
    readonly updateZippedSubmission: (params: {
      id: number
      data: Partial<NewZippedSubmission>
    }) => Effect.Effect<ZippedSubmission, DbError>
    /** Zipped submissions for a participant reference in a domain, or null if participant is missing. */
    readonly getZippedSubmissionByParticipantRefQuery: (params: {
      domain: string
      participantRef: string
    }) => Effect.Effect<ZippedSubmission[] | null, DbError>
    /** Replace all ordered submissions for a participant reference in a domain. */
    readonly updateAllSubmissions: (params: {
      reference: string
      domain: string
      updates: {
        orderIndex: number
        data: Partial<
          Omit<NewSubmission, 'id' | 'createdAt' | 'updatedAt' | 'participantId' | 'marathonId'>
        >
      }[]
    }) => Effect.Effect<Submission[], DbError>
    /** Delete one submission by id, returning the deleted row if present. */
    readonly deleteSubmissionById: (params: {
      id: number
    }) => Effect.Effect<Submission | undefined, DbError>
    /** Delete submissions by id, returning the first deleted row if present. */
    readonly deleteMultipleSubmissions: (params: {
      ids: number[]
    }) => Effect.Effect<Submission | undefined, DbError>
  }
>()('@blikka/db/submissions-repository') {}

const makeSubmissionsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const getAllSubmissionKeysForMarathon: SubmissionsRepository['Service']['getAllSubmissionKeysForMarathon'] =
    Effect.fn('SubmissionsRepository.getAllSubmissionKeysForMarathon')(function* ({ marathonId }) {
      const result = yield* use((db) =>
        db.query.submissions.findMany({
          where: (table, operators) => operators.eq(table.marathonId, marathonId),
          columns: {
            key: true,
            thumbnailKey: true,
            previewKey: true,
          },
        }),
      )
      return result
    })

  const getSubmissionById: SubmissionsRepository['Service']['getSubmissionById'] = Effect.fn(
    'SubmissionsRepository.getSubmissionById',
  )(function* ({ id }) {
    const result = yield* use((db) =>
      db.query.submissions.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
      }),
    )
    return Option.fromNullishOr(result)
  })

  const getSubmissionVoteRealtimePayloadById: SubmissionsRepository['Service']['getSubmissionVoteRealtimePayloadById'] =
    Effect.fn('SubmissionsRepository.getSubmissionVoteRealtimePayloadById')(function* ({ id }) {
      const result = yield* use((db) =>
        db
          .select({
            submissionId: submissions.id,
            submissionCreatedAt: submissions.createdAt,
            submissionKey: submissions.key,
            submissionThumbnailKey: submissions.thumbnailKey,
            participantReference: participants.reference,
            participantFirstName: participants.firstname,
            participantLastName: participants.lastname,
          })
          .from(submissions)
          .innerJoin(participants, eq(participants.id, submissions.participantId))
          .where(eq(submissions.id, id)),
      )
      return Option.fromNullishOr(result[0])
    })
  const getSubmissionByKey: SubmissionsRepository['Service']['getSubmissionByKey'] = Effect.fn(
    'SubmissionsRepository.getSubmissionByKey',
  )(function* ({ key }) {
    const result = yield* use((db) =>
      db.query.submissions.findFirst({
        where: (table, operators) => operators.eq(table.key, key),
      }),
    )
    return Option.fromNullishOr(result)
  })
  const getZippedSubmissionsByDomain: SubmissionsRepository['Service']['getZippedSubmissionsByDomain'] =
    Effect.fn('SubmissionsRepository.getZippedSubmissionsByDomain')(function* ({ domain }) {
      const result = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
          with: {
            zippedSubmissions: true,
          },
        }),
      )
      if (!result?.zippedSubmissions) return []
      const latestByParticipant = new Map<number, ZippedSubmission>()
      for (const zs of result.zippedSubmissions) {
        if (!zs.participantId) continue
        const existing = latestByParticipant.get(zs.participantId)
        if (
          !existing ||
          (zs.createdAt &&
            existing.createdAt &&
            new Date(zs.createdAt) > new Date(existing.createdAt)) ||
          (!zs.createdAt && zs.id > existing.id)
        ) {
          latestByParticipant.set(zs.participantId, zs)
        }
      }
      return Array.from(latestByParticipant.values())
    })
  const getZippedSubmissionsByMarathonId: SubmissionsRepository['Service']['getZippedSubmissionsByMarathonId'] =
    Effect.fn('SubmissionsRepository.getZippedSubmissionsByMarathonId')(function* ({ marathonId }) {
      const result = yield* use((db) =>
        db.query.zippedSubmissions.findMany({
          where: (table, operators) => operators.eq(table.marathonId, marathonId),
        }),
      )
      return result
    })
  const getManySubmissionsByKeys: SubmissionsRepository['Service']['getManySubmissionsByKeys'] =
    Effect.fn('SubmissionsRepository.getManySubmissionsByKeys')(function* ({ keys }) {
      const result = yield* use((db) =>
        db.query.submissions.findMany({
          where: (table, operators) => operators.inArray(table.key, keys),
        }),
      )
      return result
    })
  const getSubmissionsByParticipantId: SubmissionsRepository['Service']['getSubmissionsByParticipantId'] =
    Effect.fn('SubmissionsRepository.getSubmissionsByParticipantId')(function* ({ participantId }) {
      const result = yield* use((db) =>
        db.query.submissions.findMany({
          where: (table, operators) => operators.eq(table.participantId, participantId),
        }),
      )
      return result
    })
  const getSubmissionByParticipantIdAndTopicId: SubmissionsRepository['Service']['getSubmissionByParticipantIdAndTopicId'] =
    Effect.fn('SubmissionsRepository.getSubmissionByParticipantIdAndTopicId')(function* ({
      participantId,
      topicId,
    }: {
      participantId: number
      topicId: number
    }) {
      const result = yield* use((db) =>
        db.query.submissions.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.participantId, participantId),
              operators.eq(table.topicId, topicId),
            ),
        }),
      )
      return Option.fromNullishOr(result)
    })

  const getSubmissionsForJuryQuery: SubmissionsRepository['Service']['getSubmissionsForJuryQuery'] =
    Effect.fn('SubmissionsRepository.getSubmissionsForJury')(function* ({ filters }) {
      const marathon = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, filters.domain),
        }),
      )
      if (!marathon) {
        return []
      }
      const result = yield* use((db) =>
        db.query.submissions.findMany({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.marathonId, marathon.id),
              operators.eq(table.status, 'uploaded'),
            ),
          with: {
            participant: {
              with: {
                competitionClass: true,
                deviceGroup: true,
              },
            },
            topic: true,
          },
        }),
      )
      let filteredResult = result
      if (filters.competitionClassId !== null && filters.competitionClassId !== undefined) {
        filteredResult = filteredResult.filter(
          (s) => (s.participant as any).competitionClassId === filters.competitionClassId,
        )
      }
      if (filters.deviceGroupId !== null && filters.deviceGroupId !== undefined) {
        filteredResult = filteredResult.filter(
          (s) => (s.participant as any).deviceGroupId === filters.deviceGroupId,
        )
      }
      if (filters.topicId !== null && filters.topicId !== undefined) {
        filteredResult = filteredResult.filter((s) => s.topicId === filters.topicId)
      }
      return filteredResult
    })

  const createSubmission: SubmissionsRepository['Service']['createSubmission'] = Effect.fn(
    'SubmissionsRepository.createSubmission',
  )(function* ({ data }) {
    const [result] = yield* use((db) => db.insert(submissions).values(data).returning())
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to create submission',
        }),
      )
    }
    return result
  })

  const createMultipleSubmissions: SubmissionsRepository['Service']['createMultipleSubmissions'] =
    Effect.fn('SubmissionsRepository.createMultipleSubmissions')(function* ({ data }) {
      const result = yield* use((db) => db.insert(submissions).values(data).returning())
      if (result.length === 0) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to create multiple submissions',
          }),
        )
      }
      return result
    })

  const updateAllSubmissions: SubmissionsRepository['Service']['updateAllSubmissions'] = Effect.fn(
    'SubmissionsRepository.updateAllSubmissions',
  )(function* ({ updates, reference, domain }) {
    const participant = yield* use((db) =>
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
        },
      }),
    )
    if (!participant) {
      return yield* Effect.fail(
        new DbError({
          message: 'Participant not found',
        }),
      )
    }
    const data = updates.reduce<NewSubmission[]>((acc, update) => {
      const submission = participant.submissions.find(
        (s) => s.topic.orderIndex === update.orderIndex,
      )
      if (submission) {
        acc.push({ ...submission, ...update.data })
      }
      return acc
    }, [])
    const result = yield* use((db) =>
      db
        .insert(submissions)
        .values(data)
        .onConflictDoUpdate({
          target: submissions.id,
          set: conflictUpdateSetAllColumns(submissions),
        })
        .returning(),
    )
    return result
  })

  const updateSubmissionByKey: SubmissionsRepository['Service']['updateSubmissionByKey'] =
    Effect.fn('SubmissionsRepository.updateSubmissionByKeyMutation')(function* ({ key, data }) {
      const [result] = yield* use((db) =>
        db.update(submissions).set(data).where(eq(submissions.key, key)).returning(),
      )
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to update submission by key',
          }),
        )
      }
      return result
    })

  const updateSubmissionById: SubmissionsRepository['Service']['updateSubmissionById'] = Effect.fn(
    'SubmissionsRepository.updateSubmissionById',
  )(function* ({ id, data }) {
    const [result] = yield* use((db) =>
      db.update(submissions).set(data).where(eq(submissions.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to update submission by id',
        }),
      )
    }
    return result
  })

  const createZippedSubmission: SubmissionsRepository['Service']['createZippedSubmission'] =
    Effect.fn('SubmissionsRepository.createZippedSubmission')(function* ({ data }) {
      const [result] = yield* use((db) => db.insert(zippedSubmissions).values(data).returning())
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to create zipped submission',
          }),
        )
      }
      return result
    })

  const updateZippedSubmission: SubmissionsRepository['Service']['updateZippedSubmission'] =
    Effect.fn('SubmissionsRepository.updateZippedSubmission')(function* ({ id, data }) {
      const [result] = yield* use((db) =>
        db.update(zippedSubmissions).set(data).where(eq(zippedSubmissions.id, id)).returning(),
      )
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: 'Failed to update zipped submission',
          }),
        )
      }
      return result
    })

  const getZippedSubmissionByParticipantRefQuery: SubmissionsRepository['Service']['getZippedSubmissionByParticipantRefQuery'] =
    Effect.fn('SubmissionsRepository.getZippedSubmissionByParticipantRefQuery')(function* ({
      domain,
      participantRef,
    }) {
      const participant = yield* use((db) =>
        db.query.participants.findFirst({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.domain, domain),
              operators.eq(table.reference, participantRef),
            ),
          with: {
            zippedSubmissions: true,
          },
        }),
      )
      if (!participant || !participant.zippedSubmissions) {
        return null
      }
      return participant.zippedSubmissions
    })

  const deleteSubmissionById: SubmissionsRepository['Service']['deleteSubmissionById'] = Effect.fn(
    'SubmissionsRepository.deleteSubmissionById',
  )(function* ({ id }) {
    const [result] = yield* use((db) =>
      db.delete(submissions).where(eq(submissions.id, id)).returning(),
    )
    return result
  })

  const deleteMultipleSubmissions: SubmissionsRepository['Service']['deleteMultipleSubmissions'] =
    Effect.fn('SubmissionsRepository.deleteMultipleSubmissions')(function* ({ ids }) {
      const [result] = yield* use((db) =>
        db.delete(submissions).where(inArray(submissions.id, ids)).returning(),
      )
      return result
    })

  return SubmissionsRepository.of({
    getAllSubmissionKeysForMarathon,
    getSubmissionById,
    getSubmissionVoteRealtimePayloadById,
    getSubmissionByKey,
    getZippedSubmissionsByDomain,
    getZippedSubmissionsByMarathonId,
    getManySubmissionsByKeys,
    getSubmissionsByParticipantId,
    getSubmissionByParticipantIdAndTopicId,
    getSubmissionsForJuryQuery,
    createSubmission,
    createMultipleSubmissions,
    updateSubmissionByKey,
    updateSubmissionById,
    createZippedSubmission,
    updateZippedSubmission,
    getZippedSubmissionByParticipantRefQuery,
    updateAllSubmissions,
    deleteSubmissionById,
    deleteMultipleSubmissions,
  })
})

export const SubmissionsRepositoryLayerNoDeps = Layer.effect(
  SubmissionsRepository,
  makeSubmissionsRepository,
)

export const SubmissionsRepositoryLayer = SubmissionsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
