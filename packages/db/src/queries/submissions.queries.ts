import { Effect, Option } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { marathons, participants, submissions, zippedSubmissions } from "../schema"
import { and, eq, inArray } from "drizzle-orm"
import type { NewSubmission, NewZippedSubmission, ZippedSubmission } from "../types"
import { SqlError } from "@effect/sql/SqlError"
import { conflictUpdateSetAllColumns } from "../utils"

export class SubmissionsQueries extends Effect.Service<SubmissionsQueries>()(
  "@blikka/db/submissions-queries",
  {
    dependencies: [DrizzleClient.Default],
    effect: Effect.gen(function*() {
      const db = yield* DrizzleClient

      const getAllSubmissionKeysForMarathon = Effect.fn(
        "SubmissionsQueries.getAllSubmissionKeysForMarathon"
      )(function*({ marathonId }: { marathonId: number }) {
        const result = yield* db.query.submissions.findMany({
          where: eq(submissions.marathonId, marathonId),
          columns: {
            key: true,
            thumbnailKey: true,
            previewKey: true,
          },
        })

        return result
      })

      const getSubmissionById = Effect.fn("SubmissionsQueries.getSubmissionById")(function*({
        id,
      }: {
        id: number
      }) {
        const result = yield* db.query.submissions.findFirst({
          where: eq(submissions.id, id),
        })

        return Option.fromNullable(result)
      })

      const getSubmissionByKey = Effect.fn("SubmissionsQueries.getSubmissionByKey")(function*({
        key,
      }: {
        key: string
      }) {
        const result = yield* db.query.submissions.findFirst({
          where: eq(submissions.key, key),
        })

        return Option.fromNullable(result)
      })

      const getZippedSubmissionsByDomain = Effect.fn(
        "SubmissionsQueries.getZippedSubmissionsByDomain"
      )(function*({ domain }: { domain: string }) {
        const result = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
          with: {
            zippedSubmissions: true,
          },
        })

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

      const getZippedSubmissionsByMarathonId = Effect.fn(
        "SubmissionsQueries.getZippedSubmissionsByMarathonId"
      )(function*({ marathonId }: { marathonId: number }) {
        const result = yield* db.query.zippedSubmissions.findMany({
          where: eq(zippedSubmissions.marathonId, marathonId),
        })

        return result
      })

      const getManySubmissionsByKeys = Effect.fn("SubmissionsQueries.getManySubmissionsByKeys")(
        function*({ keys }: { keys: string[] }) {
          const result = yield* db.query.submissions.findMany({
            where: inArray(submissions.key, keys),
          })

          return result
        }
      )

      const getSubmissionsByParticipantId = Effect.fn(
        "SubmissionsQueries.getSubmissionsByParticipantId"
      )(function*({ participantId }: { participantId: number }) {
        const result = yield* db.query.submissions.findMany({
          where: eq(submissions.participantId, participantId),
        })

        return result
      })

      const getSubmissionsForJuryQuery = Effect.fn("SubmissionsQueries.getSubmissionsForJury")(
        function*({
          filters,
        }: {
          filters: {
            domain: string
            competitionClassId?: number | null
            deviceGroupId?: number | null
            topicId?: number | null
          }
        }) {
          const marathon = yield* db.query.marathons.findFirst({
            where: eq(marathons.domain, filters.domain),
          })

          if (!marathon) {
            return []
          }

          const conditions = [
            eq(submissions.marathonId, marathon.id),
            eq(submissions.status, "uploaded"),
          ]

          const result = yield* db.query.submissions.findMany({
            where: and(...conditions),
            with: {
              participant: {
                with: {
                  competitionClass: true,
                  deviceGroup: true,
                },
              },
              topic: true,
            },
          })

          let filteredResult = result

          if (filters.competitionClassId !== null && filters.competitionClassId !== undefined) {
            filteredResult = filteredResult.filter(
              (s) => (s.participant as any).competitionClassId === filters.competitionClassId
            )
          }

          if (filters.deviceGroupId !== null && filters.deviceGroupId !== undefined) {
            filteredResult = filteredResult.filter(
              (s) => (s.participant as any).deviceGroupId === filters.deviceGroupId
            )
          }

          if (filters.topicId !== null && filters.topicId !== undefined) {
            filteredResult = filteredResult.filter((s) => s.topicId === filters.topicId)
          }

          return filteredResult
        }
      )

      const createSubmission = Effect.fn("SubmissionsQueries.createSubmission")(function*({
        data,
      }: {
        data: NewSubmission
      }) {
        const [result] = yield* db.insert(submissions).values(data).returning()

        if (!result) {
          return yield* Effect.fail(
            new SqlError({
              cause: "Failed to create submission",
            })
          )
        }

        return result
      })

      const createMultipleSubmissions = Effect.fn("SubmissionsQueries.createMultipleSubmissions")(
        function*({ data }: { data: NewSubmission[] }) {
          const [result] = yield* db.insert(submissions).values(data).returning()
          if (!result) {
            return yield* new SqlError({
              cause: "Failed to create multiple submissions",
            })
          }
          return result
        }
      )

      const updateAllSubmissions = Effect.fn("SubmissionsQueries.updateAllSubmissions")(function*({
        updates,
        reference,
        domain,
      }: {
        reference: string
        domain: string
        updates: {
          orderIndex: number
          data: Partial<
            Omit<NewSubmission, "id" | "createdAt" | "updatedAt" | "participantId" | "marathonId">
          >
        }[]
      }) {
        const participant = yield* db.query.participants.findFirst({
          where: and(eq(participants.reference, reference), eq(participants.domain, domain)),
          with: {
            submissions: {
              with: {
                topic: true,
              },
            },
          },
        })

        if (!participant) {
          return yield* new SqlError({
            cause: "Participant not found",
          })
        }

        const data = updates.reduce<NewSubmission[]>((acc, update) => {
          const submission = participant.submissions.find(
            (s) => s.topic.orderIndex === update.orderIndex
          )
          if (submission) {
            acc.push({ ...submission, ...update.data })
          }
          return acc
        }, [])

        const result = yield* db
          .insert(submissions)
          .values(data)
          .onConflictDoUpdate({
            target: submissions.id,
            set: conflictUpdateSetAllColumns(submissions, ["id"]),
          })
          .returning()

        return result
      })

      const updateSubmissionByKey = Effect.fn("SubmissionsQueries.updateSubmissionByKeyMutation")(
        function*({ key, data }: { key: string; data: Partial<NewSubmission> }) {
          const [result] = yield* db
            .update(submissions)
            .set(data)
            .where(eq(submissions.key, key))
            .returning()
          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to update submission by key",
              })
            )
          }
          return result
        }
      )

      const updateSubmissionById = Effect.fn("SubmissionsQueries.updateSubmissionById")(function*({
        id,
        data,
      }: {
        id: number
        data: Partial<NewSubmission>
      }) {
        const [result] = yield* db
          .update(submissions)
          .set(data)
          .where(eq(submissions.id, id))
          .returning()
        if (!result) {
          return yield* Effect.fail(
            new SqlError({
              cause: "Failed to update submission by id",
            })
          )
        }
        return result
      })

      const createZippedSubmission = Effect.fn("SubmissionsQueries.createZippedSubmission")(
        function*({ data }: { data: NewZippedSubmission }) {
          const [result] = yield* db.insert(zippedSubmissions).values(data).returning()
          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to create zipped submission",
              })
            )
          }
          return result
        }
      )

      const updateZippedSubmission = Effect.fn("SubmissionsQueries.updateZippedSubmission")(
        function*({ id, data }: { id: number; data: Partial<NewZippedSubmission> }) {
          const [result] = yield* db
            .update(zippedSubmissions)
            .set(data)
            .where(eq(zippedSubmissions.id, id))
            .returning()
          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to update zipped submission",
              })
            )
          }
          return result
        }
      )

      const getZippedSubmissionByParticipantRefQuery = Effect.fn(
        "SubmissionsQueries.getZippedSubmissionByParticipantRefQuery"
      )(function*({ domain, participantRef }: { domain: string; participantRef: string }) {
        const participant = yield* db.query.participants.findFirst({
          where: and(eq(participants.domain, domain), eq(participants.reference, participantRef)),
          with: {
            zippedSubmissions: true,
          },
        })

        if (!participant || !participant.zippedSubmissions) {
          return null
        }

        return participant.zippedSubmissions
      })

      const deleteSubmissionById = Effect.fn("SubmissionsQueries.deleteSubmissionById")(function*({
        id,
      }: {
        id: number
      }) {
        const [result] = yield* db.delete(submissions).where(eq(submissions.id, id)).returning()
        return result
      })

      const deleteMultipleSubmissions = Effect.fn("SubmissionsQueries.deleteMultipleSubmissions")(function*({
        ids,
      }: {
        ids: number[]
      }) {
        const [result] = yield* db.delete(submissions).where(inArray(submissions.id, ids)).returning()
        return result
      })

      return {
        getAllSubmissionKeysForMarathon,
        getSubmissionById,
        getSubmissionByKey,
        getZippedSubmissionsByDomain,
        getZippedSubmissionsByMarathonId,
        getManySubmissionsByKeys,
        getSubmissionsByParticipantId,
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
      } as const
    }),
  }
) {
}
