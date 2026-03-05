import { Effect, Layer, ServiceMap } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { participants, submissions } from "../schema"
import { eq } from "drizzle-orm"

export class ExportsQueries extends ServiceMap.Service<ExportsQueries>()("@blikka/db/exports-queries", {
  make: Effect.gen(function* () {
    const { use } = yield* DrizzleClient

    const getParticipantsForExport = Effect.fn("ExportsQueries.getParticipantsForExport")(
      function* ({ domain }: { domain: string }) {
        const result = yield* use(db => db.query.participants.findMany({
          where: { domain },
          with: {
            competitionClass: true,
            deviceGroup: true,
            submissions: {
              columns: {
                id: true,
              },
            },
          },
          orderBy: (participants, { asc }) => [asc(participants.reference)],
        }))

        return result.map((p) => ({
          reference: p.reference,
          firstname: p.firstname,
          lastname: p.lastname,
          email: p.email || "",
          status: p.status,
          competitionClassName: p.competitionClass?.name || "",
          deviceGroupName: p.deviceGroup?.name || "",
          createdAt: p.createdAt,
          uploadCount: p.submissions?.length || 0,
        }))
      }
    )

    const getSubmissionsForExport = Effect.fn("ExportsQueries.getSubmissionsForExport")(function* ({
      domain,
    }: {
      domain: string
    }) {
      const marathon = yield* use(db => db.query.marathons.findFirst({
        where: { domain },
      }))

      if (!marathon) {
        return []
      }

      const participantsWithValidations = yield* use(db => db.query.participants.findMany({
        where: { domain },
        with: {
          validationResults: true,
        },
      }))

      const validationsByParticipantFile = new Map<string, { passed: number; failed: number }>()

      for (const participant of participantsWithValidations) {
        for (const validation of participant.validationResults) {
          if (validation.fileName) {
            const key = `${participant.id}-${validation.fileName}`
            const current = validationsByParticipantFile.get(key) || { passed: 0, failed: 0 }
            if (validation.outcome === "passed") {
              current.passed++
            } else if (validation.outcome === "failed" && !validation.overruled) {
              current.failed++
            }
            validationsByParticipantFile.set(key, current)
          }
        }
      }

      const result = yield* use(db => db.query.submissions.findMany({
        where: { marathonId: marathon.id },
        with: {
          participant: {
            with: {
              competitionClass: true,
              deviceGroup: true,
            },
          },
          topic: true,
        },
        orderBy: (submissions, { asc }) => [asc(submissions.createdAt)],
      }))

      return result.map((s) => {
        const validationKey = `${s.participantId}-${s.key}`
        const validations = validationsByParticipantFile.get(validationKey) || {
          passed: 0,
          failed: 0,
        }

        const exifData = s.exif as Record<string, any> | null
        const cameraModel = exifData?.Model || exifData?.CameraModel || ""
        const imageWidth = exifData?.ImageWidth || exifData?.ExifImageWidth || ""
        const imageHeight = exifData?.ImageHeight || exifData?.ExifImageHeight || ""
        const dimensions = imageWidth && imageHeight ? `${imageWidth}x${imageHeight}` : ""

        return {
          submissionId: s.id,
          participantReference: s.participant.reference,
          participantName: `${s.participant.firstname} ${s.participant.lastname}`,
          participantEmail: s.participant.email || "",
          competitionClassName: s.participant.competitionClass?.name || "",
          deviceGroupName: s.participant.deviceGroup?.name || "",
          topicName: s.topic.name,
          submissionStatus: s.status,
          uploadDate: s.createdAt,
          lastModified: s.updatedAt || s.createdAt,
          fileSize: s.size || 0,
          mimeType: s.mimeType || "",
          dimensions,
          cameraModel,
          validationsPassed: validations.passed,
          validationsFailed: validations.failed,
          originalKey: s.key,
          thumbnailKey: s.thumbnailKey || "",
        }
      })
    })

    const getExifDataForExport = Effect.fn("ExportsQueries.getExifDataForExport")(function* ({
      domain,
    }: {
      domain: string
    }) {
      const marathon = yield* use(db => db.query.marathons.findFirst({
        where: { domain },
      }))

      if (!marathon) {
        return []
      }

      const result = yield* use(db => db.query.submissions.findMany({
        where: { marathonId: marathon.id },
        with: {
          participant: true,
          topic: true,
        },
        orderBy: (submissions, { asc }) => [asc(submissions.createdAt)],
      }))

      return result
        .filter((s) => s.exif && s.key)
        .map((s) => ({
          submissionId: s.id,
          participantReference: s.participant.reference,
          topicName: s.topic.name,
          originalKey: s.key,
          exifData: s.exif as Record<string, unknown>,
          uploadDate: s.createdAt,
        }))
    })

    const getValidationResultsForExport = Effect.fn("ExportsQueries.getValidationResultsForExport")(
      function* ({ domain, onlyFailed }: { domain: string; onlyFailed?: boolean }) {
        const marathon = yield* use(db => db.query.marathons.findFirst({
          where: { domain },
          with: {
            participants: {
              with: {
                validationResults: true,
                submissions: {
                  columns: {
                    key: true,
                  },
                },
              },
            },
          },
        }))

        if (!marathon) {
          return []
        }

        const allResults: Array<{
          participantId: number
          participantReference: string
          participantName: string
          ruleKey: string
          severity: string
          outcome: string
          message: string
          fileName: string | null
          createdAt: string
          overruled: boolean
        }> = []

        for (const participant of marathon.participants) {
          for (const validationResult of participant.validationResults) {
            if (onlyFailed && validationResult.outcome !== "failed") {
              continue
            }

            allResults.push({
              participantId: participant.id,
              participantReference: participant.reference,
              participantName: `${participant.firstname} ${participant.lastname}`,
              ruleKey: validationResult.ruleKey,
              severity: validationResult.severity,
              outcome: validationResult.outcome,
              message: validationResult.message,
              fileName: validationResult.fileName,
              createdAt: validationResult.createdAt,
              overruled: validationResult.overruled,
            })
          }
        }

        const uniqueResults = allResults.filter((result, index, array) => {
          const key = `${result.participantId}-${result.ruleKey}-${result.fileName || "global"}`
          return (
            array.findIndex((r) => {
              const rKey = `${r.participantId}-${r.ruleKey}-${r.fileName || "global"}`
              return rKey === key
            }) === index
          )
        })

        return uniqueResults
      }
    )

    return {
      getParticipantsForExport,
      getSubmissionsForExport,
      getExifDataForExport,
      getValidationResultsForExport,
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer)
  )
}
