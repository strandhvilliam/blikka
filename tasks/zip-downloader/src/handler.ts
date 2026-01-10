import { Effect, Array, Layer, Data, Option } from "effect"
import { LambdaHandler, type APIGatewayProxyEventV2 } from "@effect-aws/lambda"
import { Database } from "@blikka/db"
import { DownloadStateManager } from "./download-state-manager"
import { RedisClient } from "@blikka/redis"
import { Resource as SSTResource } from "sst"
import { task } from "sst/aws/task"

class UnableToRunZipDownloaderTaskError extends Data.TaggedError(
  "UnableToRunZipDownloaderTaskError"
)<{
  cause?: unknown
}> {}

const MAX_PARTICIPANTS_PER_ZIP = 200

const effectHandler = (event: APIGatewayProxyEventV2) =>
  Effect.gen(function* () {
    const domain = event.queryStringParameters?.domain
    if (!domain) {
      return
      //   return yield* Effect.fail(new Error("Domain is required"))
    }

    const db = yield* Database
    const downloadStateManager = yield* DownloadStateManager

    // Validate domain exists by fetching marathon
    const zips = yield* db.zippedSubmissionsQueries.getZippedSubmissionsByDomain({ domain })

    if (zips.length === 0) {
      yield* Effect.logInfo({
        message: "No zipped submissions found for domain",
        domain,
      })
      return { message: "No zipped submissions found for domain", domain }
    }

    const zipsWithCompetitionClass = zips.filter((zip) => !!zip.participant.competitionClass)

    if (zipsWithCompetitionClass.length === 0) {
      yield* Effect.logInfo({
        message: "No zipped submissions with competition class found",
        domain,
      })
      return {
        message: "No zipped submissions with competition class found",
        domain,
      }
    }

    const byCompetitionClass = Array.groupBy(zipsWithCompetitionClass, (zip) =>
      zip.participant.competitionClass!.id.toString()
    )

    // Calculate total chunks across all competition classes
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

    // Generate processId for the overall download process
    const processId = crypto.randomUUID()

    // Create download process state
    yield* downloadStateManager.createDownloadProcess(
      processId,
      domain,
      totalChunksAcrossAllClasses
    )

    // Update process with competition classes info
    yield* downloadStateManager.updateDownloadProcess(processId, {
      competitionClasses: competitionClassesInfo,
    })

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

              // Generate unique jobId
              const jobId = crypto.randomUUID()

              // Create zipKey with 4-digit padded references
              const minRefPadded = minParticipantReference.padStart(4, "0")
              const maxRefPadded = maxParticipantReference.padStart(4, "0")
              const zipKey = `${domain}/zip-downloads/${competitionClassName}/${minRefPadded}-${maxRefPadded}.zip`

              // Save chunk state to Redis (includes processId)
              yield* downloadStateManager
                .saveChunkState(jobId, {
                  processId,
                  domain,
                  competitionClassId,
                  competitionClassName,
                  minReference: minParticipantReference,
                  maxReference: maxParticipantReference,
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
              const savedStateOption = yield* downloadStateManager.getChunkState(jobId).pipe(
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
                  message: "Failed to verify chunk state was saved to Redis - state not found",
                  jobId,
                  processId,
                })
                return yield* Effect.fail(
                  new Error(`Failed to save chunk state for jobId: ${jobId}`)
                )
              }

              // Add jobId to the download process
              yield* downloadStateManager.addJobToProcess(processId, jobId)

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

              yield* Effect.tryPromise({
                try: () => task.run(SSTResource.ZipDownloaderTask, { JOB_ID: jobId }),
                catch: (error) => new UnableToRunZipDownloaderTaskError({ cause: error }),
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

    // Update process status to processing (all jobs have been created)
    yield* downloadStateManager.updateDownloadProcess(processId, {
      status: "processing",
    })

    return {
      message: "Zip download jobs initialized",
      processId,
      domain,
      totalCompetitionClasses: Object.keys(byCompetitionClass).length,
      totalChunks: totalChunksAcrossAllClasses,
    }
  }).pipe(
    Effect.withSpan("ZipDownloader.handler"),
    Effect.catchAll((error) =>
      Effect.logError(
        `ZipDownloader.handler error: ${error instanceof Error ? error.message : String(error)}`
      )
    )
  )

const serviceLayer = Layer.mergeAll(
  Database.Default,
  DownloadStateManager.Default,
  RedisClient.Default
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
