import "server-only"

import {
  type AwsVpcConfiguration,
  ECSClient,
  RunTaskCommand,
} from "@aws-sdk/client-ecs"
import { S3Service, S3ServiceLayer, S3ClientError } from "@blikka/aws"
import { DbLayer, ZippedSubmissionsRepository, DbError } from "@blikka/db"
import {
  DownloadStateRepository,
  DownloadStateRepositoryLayer,
  type DownloadStateRepositoryError,
} from "@blikka/kv-store"
import { Effect, Array, Option, Config, Context, Schema, Layer } from "effect"

import { ZipFilesApiError } from "./errors"
import type {
  CancelDownloadProcessInput,
  GetActiveProcessInput,
  GetZipSubmissionStatusInput,
  InitializeZipDownloadsInput,
  ZipDownloadsByProcessIdInput,
} from "./contracts"

class UnableToRunZipDownloaderTaskError extends Schema.TaggedErrorClass<UnableToRunZipDownloaderTaskError>()(
  "@blikka/api/UnableToRunZipDownloaderTaskError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

const MAX_PARTICIPANTS_PER_ZIP = 200

type ZipSubmissionStats = {
  totalParticipants: number
  withZippedSubmissions: number
  missingReferences: string[]
}

type ZipProcessStatus =
  | "completed"
  | "failed"
  | "initializing"
  | "processing"
  | "cancelled"

type ZipDownloadProgressView = {
  processId: string
  status: ZipProcessStatus
  totalChunks: number
  completedChunks: number
  failedChunks: number
  failedJobIds: readonly string[]
  lastUpdatedAt: string
  competitionClasses: readonly {
    readonly competitionClassId: number
    readonly competitionClassName: string
    readonly totalChunks: number
  }[]
}

type ZipDownloadUrlItem = {
  competitionClassName: string
  minReference: number
  maxReference: number
  zipKey: string
  downloadUrl: string
}

type InitializeZipDownloadsResult =
  | {
      message: string
      domain: string
      totalChunks: number
      totalCompetitionClasses: number
      processId?: undefined
    }
  | {
      message: string
      processId: `${string}-${string}-${string}-${string}-${string}`
      domain: string
      totalCompetitionClasses: number
      totalChunks: number
    }

export class ZipFilesService extends Context.Service<
  ZipFilesService,
  {
    /** Counts participants vs zipped rows and lists references still missing zips. */
    readonly getZipSubmissionStats: (
      input: GetZipSubmissionStatusInput,
    ) => Effect.Effect<ZipSubmissionStats, DbError, never>

    /** Reads persisted download progress for a background zip job `processId`. */
    readonly getZipDownloadProgress: (
      input: ZipDownloadsByProcessIdInput,
    ) => Effect.Effect<
      ZipDownloadProgressView | null,
      DownloadStateRepositoryError,
      never
    >

    /** After completion, returns presigned GET URLs for each finished chunk ZIP. */
    readonly getZipDownloadUrls: (
      input: ZipDownloadsByProcessIdInput,
    ) => Effect.Effect<
      ZipDownloadUrlItem[] | null,
      S3ClientError | Config.ConfigError | DownloadStateRepositoryError,
      never
    >

    /**
     * Plans chunk jobs per competition class, persists process state, and triggers ECS zip-downloader tasks.
     */
    readonly initializeZipDownloads: (
      input: InitializeZipDownloadsInput,
    ) => Effect.Effect<
      InitializeZipDownloadsResult,
      Error | Config.ConfigError,
      never
    >

    /** Returns the in-flight download process for `domain` if any, or null. */
    readonly getActiveProcess: (
      input: GetActiveProcessInput,
    ) => Effect.Effect<
      ZipDownloadProgressView | null,
      DownloadStateRepositoryError,
      never
    >

    /** Marks a download process cancelled when it belongs to `domain` and is not terminal. */
    readonly cancelDownloadProcess: (
      input: CancelDownloadProcessInput,
    ) => Effect.Effect<
      { success: boolean; message: string },
      DownloadStateRepositoryError,
      never
    >
  }
>()("@blikka/api/ZipFilesService") {}

const makeZipFilesService = Effect.gen(function* () {
  const zippedSubmissionsRepository = yield* ZippedSubmissionsRepository
  const downloadStateRepository = yield* DownloadStateRepository
  const s3Service = yield* S3Service

  const getZipSubmissionStats: ZipFilesService["Service"]["getZipSubmissionStats"] =
    Effect.fn("ZipFilesService.getZipSubmissionStats")(
      function* ({ domain }) {
        const stats =
          yield* zippedSubmissionsRepository.getZipSubmissionStatsByDomain({
            domain,
          })
        return stats
      },
    )

  const getZipDownloadProgress: ZipFilesService["Service"]["getZipDownloadProgress"] =
    Effect.fn("ZipFilesService.getZipDownloadProgress")(
      function* ({ processId }) {
        const processStateOption =
          yield* downloadStateRepository.getDownloadProcess(processId)
        if (Option.isNone(processStateOption)) {
          return null
        }
        const state = processStateOption.value

        return {
          processId: state.processId,
          status: state.status,
          totalChunks: state.totalChunks,
          completedChunks: state.completedChunks,
          failedChunks: state.failedChunks,
          failedJobIds: state.failedJobIds,
          lastUpdatedAt: state.lastUpdatedAt,
          competitionClasses: state.competitionClasses,
        }
      },
    )

  const getActiveProcess: ZipFilesService["Service"]["getActiveProcess"] =
    Effect.fn("ZipFilesService.getActiveProcess")(
      function* ({ domain }) {
        const processIdOption =
          yield* downloadStateRepository.getActiveProcessForDomain(domain)

        if (Option.isNone(processIdOption)) {
          return null
        }

        const processId = processIdOption.value
        const processStateOption =
          yield* downloadStateRepository.getDownloadProcess(processId)

        if (Option.isNone(processStateOption)) {
          yield* downloadStateRepository.clearActiveProcessForDomain(domain)
          return null
        }

        const state = processStateOption.value

        return {
          processId: state.processId,
          status: state.status,
          totalChunks: state.totalChunks,
          completedChunks: state.completedChunks,
          failedChunks: state.failedChunks,
          failedJobIds: state.failedJobIds,
          lastUpdatedAt: state.lastUpdatedAt,
          competitionClasses: state.competitionClasses,
        }
      },
    )

  const cancelDownloadProcess: ZipFilesService["Service"]["cancelDownloadProcess"] =
    Effect.fn("ZipFilesService.cancelDownloadProcess")(
      function* ({ domain, processId }) {
        // Verify the process exists and belongs to this domain
        const processStateOption =
          yield* downloadStateRepository.getDownloadProcess(processId)

        if (Option.isNone(processStateOption)) {
          return { success: false, message: "Process not found" }
        }

        const state = processStateOption.value
        if (state.domain !== domain) {
          return {
            success: false,
            message: "Process does not belong to this domain",
          }
        }

        if (state.status === "completed" || state.status === "cancelled") {
          return {
            success: false,
            message: `Process is already ${state.status}`,
          }
        }

        // Cancel the process
        yield* downloadStateRepository.cancelDownloadProcess(processId)

        // Clear active process for domain
        yield* downloadStateRepository.clearActiveProcessForDomain(domain)

        yield* Effect.logInfo({
          message: "Download process cancelled",
          processId,
          domain,
        })

        return { success: true, message: "Process cancelled" }
      },
    )

  const getZipDownloadUrls: ZipFilesService["Service"]["getZipDownloadUrls"] =
    Effect.fn("ZipFilesService.getZipDownloadUrls")(
      function* ({ processId }) {
        const processStateOption =
          yield* downloadStateRepository.getDownloadProcess(processId)
        if (Option.isNone(processStateOption)) {
          return null
        }
        const processState = processStateOption.value
        if (processState.status !== "completed") {
          return null
        }

        const zipsBucket = yield* Config.string("ZIPS_BUCKET_NAME")
        const jobIds = processState.jobIds

        if (jobIds.length === 0) {
          return []
        }

        const chunkStates = yield* Effect.forEach(jobIds, (jobId) =>
          downloadStateRepository.getChunkState(jobId),
        )

        const validChunks = chunkStates
          .filter((cs) => Option.isSome(cs))
          .map((cs) => cs.value)

        const urls = yield* Effect.forEach(validChunks, (chunkState) =>
          Effect.map(
            s3Service.getPresignedUrl(zipsBucket, chunkState.zipKey, "GET", {
              expiresIn: 86400,
            }),
            (url) => ({
              competitionClassName: chunkState.competitionClassName,
              minReference: chunkState.minReference,
              maxReference: chunkState.maxReference,
              zipKey: chunkState.zipKey,
              downloadUrl: url,
            }),
          ),
        )

        return urls
      },
    )

  const initializeZipDownloads: ZipFilesService["Service"]["initializeZipDownloads"] =
    Effect.fn("ZipFilesService.initializeZipDownloads")(
      function* ({ domain }) {
        try {
          const zips =
            yield* zippedSubmissionsRepository.getZippedSubmissionsByDomain({
              domain,
            })

          if (zips.length === 0) {
            yield* Effect.logInfo({
              message: "No zipped submissions found for domain",
              domain,
            })
            return {
              message: "No zipped submissions found for domain",
              domain,
              totalChunks: 0,
              totalCompetitionClasses: 0,
            }
          }

          const zipsWithCompetitionClass = zips.filter(
            (zip) => !!zip.participant.competitionClass,
          )

          if (zipsWithCompetitionClass.length === 0) {
            yield* Effect.logInfo({
              message: "No zipped submissions with competition class found",
              domain,
            })
            return {
              message: "No zipped submissions with competition class found",
              domain,
              totalChunks: 0,
              totalCompetitionClasses: 0,
            }
          }

          const byCompetitionClass = Array.groupBy(
            zipsWithCompetitionClass,
            (zip) => zip.participant.competitionClass!.id.toString(),
          )

          let totalChunksAcrossAllClasses = 0
          const competitionClassesInfo: Array<{
            competitionClassId: number
            competitionClassName: string
            totalChunks: number
          }> = []

          for (const zips of Object.values(byCompetitionClass)) {
            if (zips.length === 0) continue
            const sortedZips = zips.sort(
              (a, b) =>
                Number(a.participant.reference) - Number(b.participant.reference),
            )
            const chunks = Array.chunksOf(sortedZips, MAX_PARTICIPANTS_PER_ZIP)
            const competitionClassId = zips[0].participant.competitionClass!.id
            const competitionClassName = zips[0].participant
              .competitionClass!.name.toLowerCase()
              .replace(/ /g, "-")
            competitionClassesInfo.push({
              competitionClassId,
              competitionClassName,
              totalChunks: chunks.length,
            })
            totalChunksAcrossAllClasses += chunks.length
          }

          const processId = crypto.randomUUID()

          yield* downloadStateRepository.createDownloadProcess(
            processId,
            domain,
            totalChunksAcrossAllClasses,
          )

          yield* downloadStateRepository.updateDownloadProcess(processId, {
            competitionClasses: competitionClassesInfo,
          })

          yield* downloadStateRepository.setActiveProcessForDomain(
            domain,
            processId,
          )

          yield* Effect.logInfo({
            message: "Download process created",
            processId,
            domain,
            totalChunks: totalChunksAcrossAllClasses,
            competitionClassesCount: competitionClassesInfo.length,
          })

          yield* Effect.forEach(Object.values(byCompetitionClass), (zips) =>
            Effect.gen(function* () {
              if (zips.length === 0) {
                return
              }

              const competitionClassId = zips[0].participant.competitionClass!.id
              const competitionClassName = zips[0].participant
                .competitionClass!.name.toLowerCase()
                .replace(/ /g, "-")

              const sortedZips = zips.sort(
                (a, b) =>
                  Number(a.participant.reference) - Number(b.participant.reference),
              )

              const chunks = Array.chunksOf(sortedZips, MAX_PARTICIPANTS_PER_ZIP)
              const totalChunks = chunks.length

              yield* Effect.logInfo({
                message: "Processing competition class chunks",
                domain,
                competitionClassId,
                competitionClassName,
                totalChunks,
                totalZips: sortedZips.length,
              })

              yield* Effect.forEach(
                chunks,
                (chunk, index) =>
                  Effect.gen(function* () {
                    if (chunk.length === 0) {
                      yield* Effect.logWarning({
                        message: "Empty chunk encountered",
                        domain,
                        competitionClassId,
                        index,
                      })
                      return
                    }

                    const minParticipantReference = chunk[0]?.participant.reference
                    const maxParticipantReference =
                      chunk[chunk.length - 1]?.participant.reference

                    if (!minParticipantReference || !maxParticipantReference) {
                      yield* Effect.logError({
                        message: "No participant references found in chunk",
                        domain,
                        competitionClassId,
                        competitionClassName,
                        index,
                        classChunksLength: chunks.length,
                        chunkLength: chunk.length,
                      })
                      return yield* Effect.fail(
                        new Error(
                          `No participant references found in chunk ${index + 1} of ${chunks.length}`,
                        ),
                      )
                    }

                    const jobId = crypto.randomUUID()

                    const minRefPadded = minParticipantReference.padStart(4, "0")
                    const maxRefPadded = maxParticipantReference.padStart(4, "0")
                    const zipKey = `${domain}/zip-downloads/${competitionClassName}/${minRefPadded}-${maxRefPadded}.zip`

                    yield* downloadStateRepository
                      .saveChunkState(jobId, {
                        processId,
                        domain,
                        competitionClassId,
                        competitionClassName,
                        minReference: Number(minParticipantReference),
                        maxReference: Number(maxParticipantReference),
                        zipKey,
                        chunkIndex: index,
                        totalChunks,
                      })
                      .pipe(
                        Effect.tapError((error) =>
                          Effect.logError({
                            message: "Failed to save chunk state to Redis",
                            jobId,
                            processId,
                            error:
                              error instanceof Error
                                ? error.message
                                : String(error),
                          }),
                        ),
                      )

                    // Verify the state was saved before triggering the task
                    const savedStateOption = yield* downloadStateRepository
                      .getChunkState(jobId)
                      .pipe(
                        Effect.tapError((error) =>
                          Effect.logError({
                            message:
                              "Failed to retrieve chunk state from Redis for verification",
                            jobId,
                            processId,
                            error:
                              error instanceof Error
                                ? error.message
                                : String(error),
                          }),
                        ),
                      )

                    if (Option.isNone(savedStateOption)) {
                      yield* Effect.logError({
                        message:
                          "Failed to verify chunk state was saved to Redis - state not found",
                        jobId,
                        processId,
                      })
                      return yield* Effect.fail(
                        new Error(
                          `Failed to save chunk state for jobId: ${jobId}`,
                        ),
                      )
                    }

                    // Add jobId to the download process
                    yield* downloadStateRepository.addJobToProcess(
                      processId,
                      jobId,
                    )

                    yield* Effect.logInfo({
                      message: "Chunk state saved to Redis and added to process",
                      processId,
                      jobId,
                      domain,
                      competitionClassId,
                      competitionClassName,
                      minReference: minParticipantReference,
                      maxReference: maxParticipantReference,
                      zipKey,
                      chunkIndex: index,
                      totalChunks,
                    })

                    const cluster = yield* Config.string("AWS_CLUSTER")
                    const region = yield* Config.string("AWS_REGION")
                    const subnetsRaw = yield* Config.string("AWS_SUBNETS")
                    const subnets = subnetsRaw
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean)

                    const taskDefinition = yield* Config.string(
                      "ZIP_DOWNLOADER_TASK_DEFINITION",
                    )

                    const ecsClient = new ECSClient({ region })
                    const networkConfig: {
                      subnets: string[]
                      assignPublicIp: "ENABLED" | "DISABLED"
                    } = {
                      subnets,
                      assignPublicIp: "ENABLED",
                    } satisfies AwsVpcConfiguration

                    yield* Effect.tryPromise({
                      try: () =>
                        ecsClient.send(
                          new RunTaskCommand({
                            cluster,
                            taskDefinition,
                            launchType: "FARGATE",
                            networkConfiguration: {
                              awsvpcConfiguration: networkConfig,
                            },
                            overrides: {
                              containerOverrides: [
                                {
                                  name: "ZipDownloaderTask",
                                  environment: [
                                    {
                                      name: "JOB_ID",
                                      value: jobId,
                                    },
                                  ],
                                },
                              ],
                            },
                          }),
                        ),
                      catch: (error) =>
                        new UnableToRunZipDownloaderTaskError({
                          message: "Failed to trigger zip downloader task",
                          cause: error,
                        }),
                    }).pipe(
                      Effect.tapError((error) =>
                        Effect.logError({
                          message: "Failed to trigger zip downloader task",
                          jobId,
                          error:
                            error instanceof Error
                              ? error.message
                              : String(error),
                        }),
                      ),
                    )
                  }),
                { concurrency: "unbounded" },
              ).pipe(
                Effect.tapError((error) =>
                  Effect.logError({
                    message: "Error processing chunks",
                    error:
                      error instanceof Error ? error.message : String(error),
                  }),
                ),
              )
            }),
          )

          yield* downloadStateRepository.updateDownloadProcess(processId, {
            status: "processing",
          })

          return {
            message: "Zip download jobs initialized",
            processId,
            domain,
            totalCompetitionClasses: Object.keys(byCompetitionClass).length,
            totalChunks: totalChunksAcrossAllClasses,
          }
        } catch (error) {
          return yield* Effect.fail(
            new ZipFilesApiError({
              message: "Failed to initialize zip downloads",
              cause: error,
            }),
          )
        }
      },
    )

  return ZipFilesService.of({
    getZipSubmissionStats,
    getZipDownloadProgress,
    getZipDownloadUrls,
    initializeZipDownloads,
    getActiveProcess,
    cancelDownloadProcess,
  })
})

export const ZipFilesServiceLayerNoDeps = Layer.effect(
  ZipFilesService,
  makeZipFilesService,
)

export const ZipFilesServiceLayer = ZipFilesServiceLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(DbLayer, DownloadStateRepositoryLayer, S3ServiceLayer),
  ),
)
