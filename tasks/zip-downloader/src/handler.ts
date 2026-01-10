import { Effect, Array, Layer, Data, Option } from "effect"
import { LambdaHandler, type APIGatewayProxyEventV2 } from "@effect-aws/lambda"
import { Database } from "@blikka/db"
import { DownloadStateRepository } from "@blikka/kv-store"
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
      yield* Effect.logError({
        message: "Domain is required",
      })
      return
    }

    const db = yield* Database
    const downloadStateRepository = yield* DownloadStateRepository

    const zips = yield* db.zippedSubmissionsQueries.getZippedSubmissionsByDomain({ domain })

    if (zips.length === 0) {
      yield* Effect.logInfo({
        message: "No zipped submissions found for domain",
        domain,
      })
      return
    }

    const zipsWithCompetitionClass = zips.filter((zip) => !!zip.participant.competitionClass)

    if (zipsWithCompetitionClass.length === 0) {
      yield* Effect.logInfo({
        message: "No zipped submissions with competition class found",
        domain,
      })
      return
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
      totalChunksAcrossAllClasses
    )

    yield* downloadStateRepository.updateDownloadProcess(processId, {
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
              const savedStateOption = yield* downloadStateRepository.getChunkState(jobId).pipe(
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
  DownloadStateRepository.Default,
  RedisClient.Default
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
