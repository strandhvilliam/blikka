import { Effect, Layer, Context } from 'effect'

import { and, eq } from 'drizzle-orm'

import { DrizzleClient } from '../drizzle-client'
import { DbError } from '../utils'

interface ParticipantExportRow {
  reference: string
  firstname: string
  lastname: string
  email: string
  status: string
  competitionClassName: string
  deviceGroupName: string
  createdAt: string
  uploadCount: number
}

interface CameraParticipantExportRow extends Omit<ParticipantExportRow, 'uploadCount'> {
  phoneEncrypted: string | null
  topicsParticipatedCount: number
  latestTopicName: string
  latestUploadedAt: string | null
}

interface SubmissionExportRow {
  submissionId: number
  participantReference: string
  participantName: string
  participantEmail: string
  phoneEncrypted: string | null
  competitionClassName: string
  deviceGroupName: string
  topicName: string
  submissionStatus: string
  uploadDate: string
  lastModified: string
  fileSize: number
  mimeType: string
  dimensions: string
  cameraModel: string
  validationsPassed: number
  validationsFailed: number
  originalKey: string
  thumbnailKey: string
}

interface ValidationResultExportRow {
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
}

interface TopicSubmissionFileExportRow {
  id: number
  key: string
  mimeType: string | null
  participant: { reference: string }
}

export class ExportsRepository extends Context.Service<
  ExportsRepository,
  {
    /** Participants for a marathon export by domain. */
    readonly getParticipantsForExport: (params: {
      domain: string
    }) => Effect.Effect<ParticipantExportRow[], DbError>
    /** Participants for a topic export by domain and topic id. */
    readonly getParticipantsForExportByTopic: (params: {
      domain: string
      topicId: number
    }) => Effect.Effect<ParticipantExportRow[], DbError>
    /** Participants with by-camera submissions across all topics. */
    readonly getParticipantsForExportByCameraAllTopics: (params: {
      domain: string
    }) => Effect.Effect<CameraParticipantExportRow[], DbError>
    /** Submissions for a marathon export by domain. */
    readonly getSubmissionsForExport: (params: {
      domain: string
    }) => Effect.Effect<SubmissionExportRow[], DbError>
    /** Submissions for a topic export by domain and topic id. */
    readonly getSubmissionsForExportByTopic: (params: {
      domain: string
      topicId: number
    }) => Effect.Effect<SubmissionExportRow[], DbError>
    /** Validation result rows for a marathon export by domain. */
    readonly getValidationResultsForExport: (params: {
      domain: string
      onlyFailed?: boolean
    }) => Effect.Effect<ValidationResultExportRow[], DbError>
    /** Validation result rows for a topic export by domain and topic id. */
    readonly getValidationResultsForExportByTopic: (params: {
      domain: string
      topicId: number
      onlyFailed?: boolean
    }) => Effect.Effect<ValidationResultExportRow[], DbError>
    /** Submission files for a topic archive export. */
    readonly getSubmissionFilesForTopicExport: (params: {
      domain: string
      topicId: number
    }) => Effect.Effect<TopicSubmissionFileExportRow[], DbError>
  }
>()('@blikka/db/exports-repository') {}

const makeExportsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const getMarathonByDomain = Effect.fn('ExportsRepository.getMarathonByDomain')(function* ({
    domain,
  }) {
    return yield* use((db) =>
      db.query.marathons.findFirst({
        where: (table, operators) => operators.eq(table.domain, domain),
      }),
    )
  })

  const getParticipantValidationCounts = Effect.fn(
    'ExportsRepository.getParticipantValidationCounts',
  )(function* ({ domain }) {
    const participantsWithValidations = yield* use((db) =>
      db.query.participants.findMany({
        where: (table, operators) => operators.eq(table.domain, domain),
        with: {
          validationResults: true,
        },
      }),
    )

    const validationsByParticipantFile = new Map<
      string,
      {
        passed: number
        failed: number
      }
    >()

    for (const participant of participantsWithValidations) {
      for (const validation of participant.validationResults) {
        if (!validation.fileName) {
          continue
        }

        const key = `${participant.id}-${validation.fileName}`
        const current = validationsByParticipantFile.get(key) || {
          passed: 0,
          failed: 0,
        }

        if (validation.outcome === 'passed') {
          current.passed++
        } else if (validation.outcome === 'failed' && !validation.overruled) {
          current.failed++
        }

        validationsByParticipantFile.set(key, current)
      }
    }

    return validationsByParticipantFile
  })

  const formatSubmissionForExport = (
    submission: {
      id: number
      participantId: number
      key: string
      thumbnailKey: string | null
      status: string
      createdAt: string
      updatedAt: string | null
      size: number | null
      mimeType: string | null
      exif: Record<string, unknown> | null
      participant: {
        reference: string
        firstname: string
        lastname: string
        email: string | null
        phoneEncrypted: string | null
        competitionClass: { name: string } | null
        deviceGroup: { name: string } | null
      }
      topic: {
        name: string
      }
    },
    validationsByParticipantFile: Map<
      string,
      {
        passed: number
        failed: number
      }
    >,
  ) => {
    const validationKey = `${submission.participantId}-${submission.key}`
    const validations = validationsByParticipantFile.get(validationKey) || {
      passed: 0,
      failed: 0,
    }
    const exifData = submission.exif as Record<string, unknown> | null
    const cameraModel =
      (exifData?.Model as string | undefined) || (exifData?.CameraModel as string | undefined) || ''
    const imageWidth =
      (exifData?.ImageWidth as number | string | undefined) ||
      (exifData?.ExifImageWidth as number | string | undefined) ||
      ''
    const imageHeight =
      (exifData?.ImageHeight as number | string | undefined) ||
      (exifData?.ExifImageHeight as number | string | undefined) ||
      ''
    const dimensions = imageWidth && imageHeight ? `${imageWidth}x${imageHeight}` : ''

    return {
      submissionId: submission.id,
      participantReference: submission.participant.reference,
      participantName: `${submission.participant.firstname} ${submission.participant.lastname}`,
      participantEmail: submission.participant.email || '',
      phoneEncrypted: submission.participant.phoneEncrypted,
      competitionClassName: submission.participant.competitionClass?.name || '',
      deviceGroupName: submission.participant.deviceGroup?.name || '',
      topicName: submission.topic.name,
      submissionStatus: submission.status,
      uploadDate: submission.createdAt,
      lastModified: submission.updatedAt || submission.createdAt,
      fileSize: submission.size || 0,
      mimeType: submission.mimeType || '',
      dimensions,
      cameraModel,
      validationsPassed: validations.passed,
      validationsFailed: validations.failed,
      originalKey: submission.key,
      thumbnailKey: submission.thumbnailKey || '',
    }
  }

  const getParticipantsForExport: ExportsRepository['Service']['getParticipantsForExport'] =
    Effect.fn('ExportsRepository.getParticipantsForExport')(function* ({ domain }) {
      const result = yield* use((db) =>
        db.query.participants.findMany({
          where: (table, operators) => operators.eq(table.domain, domain),
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
        }),
      )

      return result.map((participant) => ({
        reference: participant.reference,
        firstname: participant.firstname,
        lastname: participant.lastname,
        email: participant.email || '',
        status: participant.status,
        competitionClassName: participant.competitionClass?.name || '',
        deviceGroupName: participant.deviceGroup?.name || '',
        createdAt: participant.createdAt,
        uploadCount: participant.submissions?.length || 0,
      }))
    })

  const getParticipantsForExportByTopic: ExportsRepository['Service']['getParticipantsForExportByTopic'] =
    Effect.fn('ExportsRepository.getParticipantsForExportByTopic')(function* ({ domain, topicId }) {
      const result = yield* use((db) =>
        db.query.participants.findMany({
          where: (table, operators) => operators.eq(table.domain, domain),
          with: {
            competitionClass: true,
            deviceGroup: true,
            submissions: {
              where: (table, operators) => operators.eq(table.topicId, topicId),
              columns: {
                id: true,
              },
            },
          },
          orderBy: (participants, { asc }) => [asc(participants.reference)],
        }),
      )

      return result
        .filter((participant) => participant.submissions.length > 0)
        .map((participant) => ({
          reference: participant.reference,
          firstname: participant.firstname,
          lastname: participant.lastname,
          email: participant.email || '',
          status: participant.status,
          competitionClassName: participant.competitionClass?.name || '',
          deviceGroupName: participant.deviceGroup?.name || '',
          createdAt: participant.createdAt,
          uploadCount: participant.submissions.length,
        }))
    })

  const getParticipantsForExportByCameraAllTopics: ExportsRepository['Service']['getParticipantsForExportByCameraAllTopics'] =
    Effect.fn('ExportsRepository.getParticipantsForExportByCameraAllTopics')(function* ({
      domain,
    }) {
      const result = yield* use((db) =>
        db.query.participants.findMany({
          where: (table, operators) => operators.eq(table.domain, domain),
          with: {
            competitionClass: true,
            deviceGroup: true,
            submissions: {
              columns: {
                id: true,
                createdAt: true,
              },
              with: {
                topic: true,
              },
            },
          },
          orderBy: (participants, { asc }) => [asc(participants.reference)],
        }),
      )

      return result.map((participant) => {
        const topicIds = new Set<number>()
        let latestTopicName = ''
        let latestUploadedAt: string | null = null

        for (const submission of participant.submissions) {
          topicIds.add(submission.topic.id)

          if (
            !latestUploadedAt ||
            new Date(submission.createdAt).getTime() > new Date(latestUploadedAt).getTime()
          ) {
            latestUploadedAt = submission.createdAt
            latestTopicName = submission.topic.name
          }
        }

        return {
          reference: participant.reference,
          firstname: participant.firstname,
          lastname: participant.lastname,
          email: participant.email || '',
          phoneEncrypted: participant.phoneEncrypted,
          status: participant.status,
          competitionClassName: participant.competitionClass?.name || '',
          deviceGroupName: participant.deviceGroup?.name || '',
          createdAt: participant.createdAt,
          topicsParticipatedCount: topicIds.size,
          latestTopicName,
          latestUploadedAt,
        }
      })
    })

  const getSubmissionsForExport: ExportsRepository['Service']['getSubmissionsForExport'] =
    Effect.fn('ExportsRepository.getSubmissionsForExport')(function* ({ domain }) {
      const marathon = yield* getMarathonByDomain({ domain })

      if (!marathon) {
        return []
      }

      const validationsByParticipantFile = yield* getParticipantValidationCounts({
        domain,
      })

      const result = yield* use((db) =>
        db.query.submissions.findMany({
          where: (table, operators) => operators.eq(table.marathonId, marathon.id),
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
        }),
      )

      return result.map((submission) =>
        formatSubmissionForExport(submission, validationsByParticipantFile),
      )
    })

  const getSubmissionsForExportByTopic: ExportsRepository['Service']['getSubmissionsForExportByTopic'] =
    Effect.fn('ExportsRepository.getSubmissionsForExportByTopic')(function* ({ domain, topicId }) {
      const marathon = yield* getMarathonByDomain({ domain })

      if (!marathon) {
        return []
      }

      const validationsByParticipantFile = yield* getParticipantValidationCounts({
        domain,
      })

      const result = yield* use((db) =>
        db.query.submissions.findMany({
          where: (table, operators) =>
            operators.and(
              operators.eq(table.marathonId, marathon.id),
              operators.eq(table.topicId, topicId),
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
          orderBy: (submissions, { asc }) => [asc(submissions.createdAt)],
        }),
      )

      return result.map((submission) =>
        formatSubmissionForExport(submission, validationsByParticipantFile),
      )
    })

  const getValidationResultsForExport: ExportsRepository['Service']['getValidationResultsForExport'] =
    Effect.fn('ExportsRepository.getValidationResultsForExport')(function* ({
      domain,
      onlyFailed,
    }) {
      const marathon = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
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
        }),
      )

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
          if (onlyFailed && validationResult.outcome !== 'failed') {
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

      return allResults.filter((result, index, array) => {
        const key = `${result.participantId}-${result.ruleKey}-${result.fileName || 'global'}`

        return (
          array.findIndex((candidate) => {
            const candidateKey = `${candidate.participantId}-${candidate.ruleKey}-${candidate.fileName || 'global'}`
            return candidateKey === key
          }) === index
        )
      })
    })

  const getValidationResultsForExportByTopic: ExportsRepository['Service']['getValidationResultsForExportByTopic'] =
    Effect.fn('ExportsRepository.getValidationResultsForExportByTopic')(function* ({
      domain,
      topicId,
      onlyFailed,
    }) {
      const marathon = yield* use((db) =>
        db.query.marathons.findFirst({
          where: (table, operators) => operators.eq(table.domain, domain),
          with: {
            participants: {
              with: {
                validationResults: true,
                submissions: {
                  columns: {
                    key: true,
                    topicId: true,
                  },
                },
              },
            },
          },
        }),
      )

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
        const topicSubmissionKeys = new Set(
          participant.submissions
            .filter((submission) => submission.topicId === topicId)
            .map((submission) => submission.key),
        )

        if (topicSubmissionKeys.size === 0) {
          continue
        }

        for (const validationResult of participant.validationResults) {
          if (onlyFailed && validationResult.outcome !== 'failed') {
            continue
          }

          if (!validationResult.fileName) {
            continue
          }

          if (!topicSubmissionKeys.has(validationResult.fileName)) {
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

      return allResults.filter((result, index, array) => {
        const key = `${result.participantId}-${result.ruleKey}-${result.fileName}`

        return (
          array.findIndex((candidate) => {
            const candidateKey = `${candidate.participantId}-${candidate.ruleKey}-${candidate.fileName}`
            return candidateKey === key
          }) === index
        )
      })
    })

  const getSubmissionFilesForTopicExport: ExportsRepository['Service']['getSubmissionFilesForTopicExport'] =
    Effect.fn('ExportsRepository.getSubmissionFilesForTopicExport')(function* ({
      domain,
      topicId,
    }) {
      const marathon = yield* getMarathonByDomain({ domain })

      if (!marathon) {
        return []
      }

      return yield* use((db) =>
        db.query.submissions.findMany({
          where: (table) => and(eq(table.marathonId, marathon.id), eq(table.topicId, topicId)),
          columns: {
            id: true,
            key: true,
            mimeType: true,
          },
          with: {
            participant: {
              columns: {
                reference: true,
              },
            },
          },
          orderBy: (submissions, { asc }) => [asc(submissions.createdAt)],
        }),
      )
    })

  return ExportsRepository.of({
    getParticipantsForExport,
    getParticipantsForExportByTopic,
    getParticipantsForExportByCameraAllTopics,
    getSubmissionsForExport,
    getSubmissionsForExportByTopic,
    getValidationResultsForExport,
    getValidationResultsForExportByTopic,
    getSubmissionFilesForTopicExport,
  })
})

export const ExportsRepositoryLayerNoDeps = Layer.effect(ExportsRepository, makeExportsRepository)

export const ExportsRepositoryLayer = ExportsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
