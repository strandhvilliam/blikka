import "server-only"

import { extname } from "node:path"
import archiver from "archiver"
import { Config, Effect, Layer, Option, Context } from "effect"

import { S3Service, S3ServiceLayer, S3ClientError } from "@blikka/aws"
import { DbLayer, ExportsRepository, MarathonsRepository, DbError } from "@blikka/db"

import {
  EncryptedPhoneNumber,
  PhoneNumberEncryptionService,
  PhoneNumberEncryptionServiceLayer,
} from "../utils/phone-number-encryption"
import {
  BadRequestError,
  NotFoundError,
  failNotFoundIfNone,
} from "../errors"
import type {
  DomainScopedExportInput,
  GetValidationResultsExportDataInput,
} from "./contracts"

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

interface ParticipantByCameraAllTopicsExportRow {
  phoneNumber: string
  topicsParticipatedCount: number
  latestTopicName: string
  latestUploadedAt: string | null
  createdAt: string
  reference: string
  email: string
  status: string
  firstname: string
  lastname: string
  competitionClassName: string
  deviceGroupName: string
}

interface SubmissionExportRow {
  phoneNumber: string
  submissionId: number
  participantReference: string
  participantName: string
  participantEmail: string
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

export class ExportsService extends Context.Service<
  ExportsService,
  {
    /** Participants CSV-style export rows for a marathon `domain`. */
    readonly getParticipantsExportData: (
      input: DomainScopedExportInput,
    ) => Effect.Effect<ParticipantExportRow[], DbError | BadRequestError, never>

    /** Participants export scoped to the active by-camera topic for `domain`. */
    readonly getParticipantsExportDataByCameraActiveTopic: (
      input: DomainScopedExportInput,
    ) => Effect.Effect<
      ParticipantExportRow[],
      DbError | BadRequestError | NotFoundError,
      never
    >

    /** By-camera participants across topics with decrypted phone for export. */
    readonly getParticipantsExportDataByCameraAllTopics: (
      input: DomainScopedExportInput,
    ) => Effect.Effect<
      ParticipantByCameraAllTopicsExportRow[],
      DbError | BadRequestError,
      never
    >

    /** Submissions export rows with decrypted phone numbers for `domain`. */
    readonly getSubmissionsExportData: (
      input: DomainScopedExportInput,
    ) => Effect.Effect<SubmissionExportRow[], DbError | BadRequestError, never>

    /** Submissions for the active by-camera topic only. */
    readonly getSubmissionsExportDataByCameraActiveTopic: (
      input: DomainScopedExportInput,
    ) => Effect.Effect<
      SubmissionExportRow[],
      DbError | BadRequestError | NotFoundError,
      never
    >

    /** Validation result rows for organizer export; optional failed-only filter. */
    readonly getValidationResultsExportData: (
      input: GetValidationResultsExportDataInput,
    ) => Effect.Effect<
      ValidationResultExportRow[],
      DbError | BadRequestError,
      never
    >

    /** Validation results for the active by-camera topic. */
    readonly getValidationResultsExportDataByCameraActiveTopic: (
      input: GetValidationResultsExportDataInput,
    ) => Effect.Effect<
      ValidationResultExportRow[],
      DbError | BadRequestError | NotFoundError,
      never
    >

    /** Builds a ZIP of original images for the active by-camera topic. */
    readonly buildByCameraActiveTopicImagesZip: (
      input: DomainScopedExportInput,
    ) => Effect.Effect<
      { topicName: string; zipBuffer: Buffer },
      | DbError
      | S3ClientError
      | Config.ConfigError
      | BadRequestError
      | NotFoundError,
      never
    >
  }
>()("@blikka/api/ExportsService") {}

const makeExportsService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const exportsRepository = yield* ExportsRepository
  const s3 = yield* S3Service
  const phoneEncryption = yield* PhoneNumberEncryptionService

  const getActiveByCameraTopic = Effect.fn(
    "ExportsService.getActiveByCameraTopic",
  )(function* ({ domain }) {
    const marathon = yield* marathonsRepository
      .getMarathonByDomainWithOptions({ domain })
      .pipe(failNotFoundIfNone("Marathon", { domain }))

    if (marathon.mode !== "by-camera") {
      return yield* Effect.fail(
        new BadRequestError({
          message: `Marathon '${domain}' is not in by-camera mode`,
        }),
      )
    }

    const activeTopic =
      marathon.topics.find((topic) => topic.visibility === "active") ?? null

    if (!activeTopic) {
      return yield* Effect.fail(
        new NotFoundError({
          resource: "ActiveTopic",
          identifier: { domain },
        }),
      )
    }

    return activeTopic
  })

  const buildArchiveBuffer = Effect.fn("ExportsService.buildArchiveBuffer")(
    function* (
      files: ReadonlyArray<{
        data: Buffer
        name: string
      }>,
    ) {
      return yield* Effect.tryPromise({
        try: () =>
          new Promise<Buffer>((resolve, reject) => {
            const archive = archiver("zip", {
              zlib: { level: 6 },
            })
            const chunks: Buffer[] = []

            archive.on("data", (chunk: Buffer) => chunks.push(chunk))
            archive.on("end", () => resolve(Buffer.concat(chunks)))
            archive.on("error", reject)

            for (const file of files) {
              archive.append(file.data, { name: file.name })
            }

            void archive.finalize()
          }),
        catch: (error) =>
          new BadRequestError({
            message: "Failed to build export archive",
            cause: error,
          }),
      })
    },
  )

  const getSubmissionFileExtension = (key: string, mimeType: string | null) => {
    const fileExtension = extname(key)

    if (fileExtension) {
      return fileExtension.toLowerCase()
    }

    switch (mimeType) {
      case "image/png":
        return ".png"
      case "image/webp":
        return ".webp"
      case "image/heic":
        return ".heic"
      case "image/heif":
        return ".heif"
      case "image/tiff":
        return ".tif"
      default:
        return ".jpg"
    }
  }

  const getParticipantsExportData: ExportsService["Service"]["getParticipantsExportData"] =
    Effect.fn("ExportsService.getParticipantsExportData")(
      function* ({ domain }) {
        try {
          return yield* exportsRepository.getParticipantsForExport({ domain })
        } catch (error) {
          return yield* Effect.fail(
            new BadRequestError({
              message: "Failed to fetch participants export data",
              cause: error,
            }),
          )
        }
      },
    )

  const getParticipantsExportDataByCameraActiveTopic: ExportsService["Service"]["getParticipantsExportDataByCameraActiveTopic"] =
    Effect.fn("ExportsService.getParticipantsExportDataByCameraActiveTopic")(
      function* ({ domain }) {
        try {
          const activeTopic = yield* getActiveByCameraTopic({ domain })

          return yield* exportsRepository.getParticipantsForExportByTopic({
            domain,
            topicId: activeTopic.id,
          })
        } catch (error) {
          return yield* Effect.fail(
            new BadRequestError({
              message: "Failed to fetch by-camera participants export data",
              cause: error,
            }),
          )
        }
      },
    )

  const getParticipantsExportDataByCameraAllTopics: ExportsService["Service"]["getParticipantsExportDataByCameraAllTopics"] =
    Effect.fn("ExportsService.getParticipantsExportDataByCameraAllTopics")(
      function* ({ domain }) {
        try {
          const participants =
            yield* exportsRepository.getParticipantsForExportByCameraAllTopics({
              domain,
            })

          return yield* Effect.forEach(
            participants,
            (participant) =>
              Effect.gen(function* () {
                const phoneNumber = participant.phoneEncrypted
                  ? yield* phoneEncryption
                      .decrypt({
                        encrypted:
                          participant.phoneEncrypted as EncryptedPhoneNumber,
                      })
                      .pipe(Effect.catch(() => Effect.succeed("")))
                  : ""

                const { phoneEncrypted, ...rest } = participant

                return {
                  ...rest,
                  phoneNumber,
                }
              }),
            { concurrency: 8 },
          )
        } catch (error) {
          return yield* Effect.fail(
            new BadRequestError({
              message:
                "Failed to fetch by-camera all-topic participants export data",
              cause: error,
            }),
          )
        }
      },
    )

  const getSubmissionsExportData: ExportsService["Service"]["getSubmissionsExportData"] =
    Effect.fn("ExportsService.getSubmissionsExportData")(
      function* ({ domain }) {
        try {
          const rows = yield* exportsRepository.getSubmissionsForExport({
            domain,
          })

          return yield* Effect.forEach(
            rows,
            (submission) =>
              Effect.gen(function* () {
                const phoneNumber = submission.phoneEncrypted
                  ? yield* phoneEncryption
                      .decrypt({
                        encrypted:
                          submission.phoneEncrypted as EncryptedPhoneNumber,
                      })
                      .pipe(Effect.catch(() => Effect.succeed("")))
                  : ""

                const { phoneEncrypted, ...rest } = submission

                return {
                  ...rest,
                  phoneNumber,
                }
              }),
            { concurrency: 8 },
          )
        } catch (error) {
          return yield* Effect.fail(
            new BadRequestError({
              message: "Failed to fetch submissions export data",
              cause: error,
            }),
          )
        }
      },
    )

  const getSubmissionsExportDataByCameraActiveTopic: ExportsService["Service"]["getSubmissionsExportDataByCameraActiveTopic"] =
    Effect.fn("ExportsService.getSubmissionsExportDataByCameraActiveTopic")(
      function* ({ domain }) {
        try {
          const activeTopic = yield* getActiveByCameraTopic({ domain })

          const rows = yield* exportsRepository.getSubmissionsForExportByTopic({
            domain,
            topicId: activeTopic.id,
          })

          return yield* Effect.forEach(
            rows,
            (submission) =>
              Effect.gen(function* () {
                const phoneNumber = submission.phoneEncrypted
                  ? yield* phoneEncryption
                      .decrypt({
                        encrypted:
                          submission.phoneEncrypted as EncryptedPhoneNumber,
                      })
                      .pipe(Effect.catch(() => Effect.succeed("")))
                  : ""

                const { phoneEncrypted, ...rest } = submission

                return {
                  ...rest,
                  phoneNumber,
                }
              }),
            { concurrency: 8 },
          )
        } catch (error) {
          return yield* Effect.fail(
            new BadRequestError({
              message: "Failed to fetch by-camera submissions export data",
              cause: error,
            }),
          )
        }
      },
    )

  const getValidationResultsExportData: ExportsService["Service"]["getValidationResultsExportData"] =
    Effect.fn("ExportsService.getValidationResultsExportData")(
      function* ({ domain, onlyFailed }) {
        try {
          return yield* exportsRepository.getValidationResultsForExport({
            domain,
            onlyFailed,
          })
        } catch (error) {
          return yield* Effect.fail(
            new BadRequestError({
              message: "Failed to fetch validation results export data",
              cause: error,
            }),
          )
        }
      },
    )

  const getValidationResultsExportDataByCameraActiveTopic: ExportsService["Service"]["getValidationResultsExportDataByCameraActiveTopic"] =
    Effect.fn(
      "ExportsService.getValidationResultsExportDataByCameraActiveTopic",
    )(function* ({ domain, onlyFailed }) {
      try {
        const activeTopic = yield* getActiveByCameraTopic({ domain })

        return yield* exportsRepository.getValidationResultsForExportByTopic({
          domain,
          topicId: activeTopic.id,
          onlyFailed,
        })
      } catch (error) {
        return yield* Effect.fail(
          new BadRequestError({
            message:
              "Failed to fetch by-camera validation results export data",
            cause: error,
          }),
        )
      }
    })

  const buildByCameraActiveTopicImagesZip: ExportsService["Service"]["buildByCameraActiveTopicImagesZip"] =
    Effect.fn("ExportsService.buildByCameraActiveTopicImagesZip")(
      function* ({ domain }) {
        try {
          const activeTopic = yield* getActiveByCameraTopic({ domain })
          const submissionsBucketName = yield* Config.string(
            "SUBMISSIONS_BUCKET_NAME",
          )
          const submissions =
            yield* exportsRepository.getSubmissionFilesForTopicExport({
              domain,
              topicId: activeTopic.id,
            })

          const files = yield* Effect.forEach(
            submissions,
            (submission) =>
              Effect.gen(function* () {
                const fileOption = yield* s3.getFile(
                  submissionsBucketName,
                  submission.key,
                )

                if (Option.isNone(fileOption)) {
                  return yield* Effect.fail(
                    new NotFoundError({
                      resource: "SubmissionFile",
                      identifier: { key: submission.key },
                    }),
                  )
                }

                return {
                  data: Buffer.from(fileOption.value),
                  name: `${submission.participant.reference.padStart(4, "0")}-${submission.id}${getSubmissionFileExtension(
                    submission.key,
                    submission.mimeType,
                  )}`,
                }
              }),
            { concurrency: 5 },
          )

          const zipBuffer = yield* buildArchiveBuffer(files)

          return {
            topicName: activeTopic.name,
            zipBuffer,
          }
        } catch (error) {
          return yield* Effect.fail(
            new BadRequestError({
              message: "Failed to build by-camera topic image archive",
              cause: error,
            }),
          )
        }
      },
    )

  return ExportsService.of({
    getParticipantsExportData,
    getParticipantsExportDataByCameraActiveTopic,
    getParticipantsExportDataByCameraAllTopics,
    getSubmissionsExportData,
    getSubmissionsExportDataByCameraActiveTopic,
    getValidationResultsExportData,
    getValidationResultsExportDataByCameraActiveTopic,
    buildByCameraActiveTopicImagesZip,
  })
})

export const ExportsServiceLayerNoDeps = Layer.effect(
  ExportsService,
  makeExportsService,
)

export const ExportsServiceLayer = ExportsServiceLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(DbLayer, S3ServiceLayer, PhoneNumberEncryptionServiceLayer),
  ),
)
