import { Effect, Array, Data, Option, Config, ServiceMap, Schema, Layer } from "effect"
import { Database } from "@blikka/db"
import { DownloadStateRepository } from "@blikka/kv-store"
import { S3Service } from "@blikka/aws"
import { type AwsVpcConfiguration, ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs"
import { ZipFilesApiError } from "./schemas"

class UnableToRunZipDownloaderTaskError extends Schema.TaggedErrorClass<UnableToRunZipDownloaderTaskError>()(
  "@blikka/api/UnableToRunZipDownloaderTaskError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

const MAX_PARTICIPANTS_PER_ZIP = 200

export class ZipFilesApiService extends ServiceMap.Service<ZipFilesApiService>()(
  "@blikka/api/ZipFilesApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const downloadStateRepository = yield* DownloadStateRepository
      const s3Service = yield* S3Service

      const getZipSubmissionStats = Effect.fn("ZipFilesApiService.getZipSubmissionStats")(
        function* ({ domain }: { domain: string }) {
          const stats = yield* db.zippedSubmissionsQueries.getZipSubmissionStatsByDomain({
            domain,
          })
          return stats
        }
      )

      const getZipDownloadProgress = Effect.fn("ZipFilesApiService.getZipDownloadProgress")(
        function* ({ processId }: { processId: string }) {
          const processStateOption = yield* downloadStateRepository.getDownloadProcess(processId)
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
        }
      )

      const getActiveProcess = Effect.fn("ZipFilesApiService.getActiveProcess")(function* ({
        domain,
      }: {
        domain: string
      }) {
        const processIdOption = yield* downloadStateRepository.getActiveProcessForDomain(domain)

        if (Option.isNone(processIdOption)) {
          return null
        }

        const processId = processIdOption.value
        const processStateOption = yield* downloadStateRepository.getDownloadProcess(processId)

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
      })

      const cancelDownloadProcess = Effect.fn("ZipFilesApiService.cancelDownloadProcess")(
        function* ({ domain, processId }: { domain: string; processId: string }) {
          // Verify the process exists and belongs to this domain
          const processStateOption = yield* downloadStateRepository.getDownloadProcess(processId)

          if (Option.isNone(processStateOption)) {
            return { success: false, message: "Process not found" }
          }

          const state = processStateOption.value
          if (state.domain !== domain) {
            return { success: false, message: "Process does not belong to this domain" }
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
        }
      )

      const getZipDownloadUrls = Effect.fn("ZipFilesApiService.getZipDownloadUrls")(function* ({
        processId,
      }: {
        processId: string
      }) {
        const processStateOption = yield* downloadStateRepository.getDownloadProcess(processId)
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
          downloadStateRepository.getChunkState(jobId)
        )

        const validChunks = chunkStates.filter((cs) => Option.isSome(cs)).map((cs) => cs.value)

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
            })
          )
        )

        return urls
      })

      const initializeZipDownloads = Effect.fn("ZipFilesApiService.initializeZipDownloads")(
        function* ({ domain }: { domain: string }) {
          try {
            const zips = yield* db.zippedSubmissionsQueries.getZippedSubmissionsByDomain({
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
              (zip) => !!zip.participant.competitionClass
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

            const byCompetitionClass = Array.groupBy(zipsWithCompetitionClass, (zip) =>
              zip.participant.competitionClass!.id.toString()
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
                (a, b) => Number(a.participant.reference) - Number(b.participant.reference)
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

            yield* downloadStateRepository.setActiveProcessForDomain(domain, processId)

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
                  (a, b) => Number(a.participant.reference) - Number(b.participant.reference)
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
                      const maxParticipantReference = chunk[chunk.length - 1]?.participant.reference

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
                            `No participant references found in chunk ${index + 1} of ${chunks.length}`
                          )
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
                              error: error instanceof Error ? error.message : String(error),
                            })
                          )
                        )

                      // Verify the state was saved before triggering the task
                      const savedStateOption = yield* downloadStateRepository
                        .getChunkState(jobId)
                        .pipe(
                          Effect.tapError((error) =>
                            Effect.logError({
                              message: "Failed to retrieve chunk state from Redis for verification",
                              jobId,
                              processId,
                              error: error instanceof Error ? error.message : String(error),
                            })
                          )
                        )

                      if (Option.isNone(savedStateOption)) {
                        yield* Effect.logError({
                          message:
                            "Failed to verify chunk state was saved to Redis - state not found",
                          jobId,
                          processId,
                        })
                        return yield* Effect.fail(
                          new Error(`Failed to save chunk state for jobId: ${jobId}`)
                        )
                      }

                      // Add jobId to the download process
                      yield* downloadStateRepository.addJobToProcess(processId, jobId)

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
                      const subnets = subnetsRaw.split(",").map((s: string) => s.trim()).filter(Boolean)

                      const taskDefinition = yield* Config.string("ZIP_DOWNLOADER_TASK_DEFINITION")

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
                            })
                          ),
                        catch: (error) => new UnableToRunZipDownloaderTaskError({ message: "Failed to trigger zip downloader task", cause: error }),
                      }).pipe(
                        Effect.tapError((error) =>
                          Effect.logError({
                            message: "Failed to trigger zip downloader task",
                            jobId,
                            error: error instanceof Error ? error.message : String(error),
                          })
                        )
                      )
                    }),
                  { concurrency: "unbounded" }
                ).pipe(
                  Effect.tapError((error) =>
                    Effect.logError({
                      message: "Error processing chunks",
                      error: error instanceof Error ? error.message : String(error),
                    })
                  )
                )
              })
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
              })
            )
          }
        }
      )

      return {
        getZipSubmissionStats,
        getZipDownloadProgress,
        getZipDownloadUrls,
        initializeZipDownloads,
        getActiveProcess,
        cancelDownloadProcess,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(
      Database.layer,
      DownloadStateRepository.layer,
      S3Service.layer,
    ))
  )
}
