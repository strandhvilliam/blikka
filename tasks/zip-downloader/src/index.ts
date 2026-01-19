import { Config, Effect, Schema, Option, Layer, Data } from "effect"
import { DownloadStateRepository } from "@blikka/kv-store"
import { Database } from "@blikka/db"
import { RedisClient } from "@blikka/redis"
import { TelemetryLayer } from "@blikka/telemetry"
import { S3Service } from "@blikka/s3"
import archiver from "archiver"
import JSZip from "jszip"

// Custom error types for better error tracking
class ProcessCancelledError extends Data.TaggedError("ProcessCancelledError")<{
  processId: string
  jobId: string
}> {}

class ChunkStateNotFoundError extends Data.TaggedError("ChunkStateNotFoundError")<{
  jobId: string
}> {}

class ZipProcessingError extends Data.TaggedError("ZipProcessingError")<{
  message: string
  jobId: string
  processId?: string
  cause?: unknown
}> {}

const parseJobId = Effect.gen(function* () {
  const jobId = yield* Schema.Config("JOB_ID", Schema.String)
  return jobId
}).pipe(
  Effect.mapError(
    (error) => new Error(`Failed to parse JOB_ID environment variable: ${String(error)}`)
  )
)

const processJob = Effect.gen(function* () {
  const db = yield* Database
  const downloadStateRepository = yield* DownloadStateRepository
  const s3Service = yield* S3Service
  const zipsBucket = yield* Config.string("ZIPS_BUCKET_NAME")

  // Read JOB_ID from environment variable
  const jobId = yield* parseJobId

  yield* Effect.logInfo({
    message: "Starting zip download job processing",
    jobId,
  })


  // Retrieve chunk state from Redis
  const chunkStateOption = yield* downloadStateRepository.getChunkState(jobId)

  yield* Effect.logInfo({
    message: "Chunk state",
    chunkStateOption,
  })

  if (Option.isNone(chunkStateOption)) {
    return yield* Effect.fail(new ChunkStateNotFoundError({ jobId }))
  }

  const chunkState = chunkStateOption.value

  yield* Effect.logInfo({
    message: "Retrieved chunk state from Redis",
    jobId,
    processId: chunkState.processId,
    domain: chunkState.domain,
    competitionClassId: chunkState.competitionClassId,
    minReference: chunkState.minReference,
    maxReference: chunkState.maxReference,
    zipKey: chunkState.zipKey,
  })

  // Check if the process is still active (not cancelled)
  const isActive = yield* downloadStateRepository.isProcessActive(chunkState.processId)
  if (!isActive) {
    yield* Effect.logWarning({
      message: "Process is no longer active (cancelled or failed), skipping job",
      jobId,
      processId: chunkState.processId,
    })
    return yield* Effect.fail(new ProcessCancelledError({ processId: chunkState.processId, jobId }))
  }

  // Query zippedSubmissions for the chunk using reference range
  const zippedSubmissions = yield* db.zippedSubmissionsQueries.getZippedSubmissionsByReferenceRange(
    {
      domain: chunkState.domain,
      competitionClassId: chunkState.competitionClassId,
      minReference: chunkState.minReference,
      maxReference: chunkState.maxReference,
    }
  )

  yield* Effect.logInfo({
    message: "Retrieved zippedSubmissions for chunk",
    jobId,
    zipKey: chunkState.zipKey,
    zippedSubmissionsCount: zippedSubmissions.length,
    minReference: chunkState.minReference,
    maxReference: chunkState.maxReference,
  })

  if (zippedSubmissions.length === 0) {
    yield* Effect.logWarning({
      message: "No zippedSubmissions to process, marking as completed",
      jobId,
      zipKey: chunkState.zipKey,
    })

    // Still mark as completed (empty chunk is valid)
    yield* downloadStateRepository.atomicIncrementCompleted(
      chunkState.processId,
      chunkState.totalChunks
    )

    return {
      jobId,
      zipKey: chunkState.zipKey,
      zippedSubmissionsCount: 0,
      message: "No zippedSubmissions to process",
      archiveSize: 0,
      processId: chunkState.processId,
    }
  }

  yield* Effect.logInfo({
    message: "Starting zip processing",
    jobId,
    zipKey: chunkState.zipKey,
    zippedSubmissionsCount: zippedSubmissions.length,
    zipsBucket,
  })

  // Process each participant zip and collect file data
  const processParticipantZip = Effect.fn("processParticipantZip")(function* (
    zippedSubmission: (typeof zippedSubmissions)[0]
  ) {
    const participantReference = zippedSubmission.participant.reference
    const zipKey = zippedSubmission.key

    yield* Effect.logInfo({
      message: "Processing participant zip",
      jobId,
      participantReference,
      zipKey,
    })

    // Download participant zip from S3
    const zipFileOption = yield* s3Service.getFile(zipsBucket, zipKey)

    if (Option.isNone(zipFileOption)) {
      yield* Effect.logError({
        message: "Failed to download participant zip from S3",
        jobId,
        participantReference,
        zipKey,
      })
      return yield* Effect.fail(
        new ZipProcessingError({
          message: `Failed to download zip for participant ${participantReference}: ${zipKey}`,
          jobId,
          processId: chunkState.processId,
        })
      )
    }

    const zipBuffer = Buffer.from(zipFileOption.value)

    // Load zip with JSZip and extract files
    const participantZip = yield* Effect.tryPromise({
      try: () => JSZip.loadAsync(zipBuffer),
      catch: (error) =>
        new ZipProcessingError({
          message: `Failed to load zip for participant ${participantReference}`,
          jobId,
          processId: chunkState.processId,
          cause: error,
        }),
    })

    // Extract all files with their paths
    const files = yield* Effect.tryPromise({
      try: async () => {
        const fileEntries: Array<{ path: string; data: Buffer }> = []
        const filePromises: Promise<void>[] = []

        participantZip.forEach((relativePath: string, file: JSZip.JSZipObject) => {
          if (file.dir) {
            return
          }

          const promise = (async () => {
            const fileData = await file.async("nodebuffer")
            fileEntries.push({
              path: `${participantReference}/${relativePath}`,
              data: Buffer.from(fileData),
            })
          })()

          filePromises.push(promise)
        })

        await Promise.all(filePromises)
        return fileEntries
      },
      catch: (error) =>
        new ZipProcessingError({
          message: `Failed to extract files for participant ${participantReference}`,
          jobId,
          processId: chunkState.processId,
          cause: error,
        }),
    })

    yield* Effect.logInfo({
      message: "Completed processing participant zip",
      jobId,
      participantReference,
      zipKey,
      filesCount: files.length,
    })

    return files
  })

  // Process all participant zips
  const allFiles = yield* Effect.forEach(zippedSubmissions, processParticipantZip, {
    concurrency: 5,
  }).pipe(Effect.map((results) => results.flat()))

  // Check again if the process is still active before uploading
  const stillActive = yield* downloadStateRepository.isProcessActive(chunkState.processId)
  if (!stillActive) {
    yield* Effect.logWarning({
      message: "Process cancelled during processing, aborting upload",
      jobId,
      processId: chunkState.processId,
    })
    return yield* Effect.fail(new ProcessCancelledError({ processId: chunkState.processId, jobId }))
  }

  // Create final zip with archiver
  const archiveBuffer = yield* Effect.tryPromise({
    try: () => {
      return new Promise<Buffer>((resolve, reject) => {
        const archive = archiver("zip", {
          zlib: { level: 6 },
        })

        const chunks: Buffer[] = []
        archive.on("data", (chunk: Buffer) => chunks.push(chunk))
        archive.on("end", () => resolve(Buffer.concat(chunks)))
        archive.on("error", reject)

        // Add all files to archive
        for (const file of allFiles) {
          archive.append(file.data, { name: file.path })
        }

        // Finalize the archive
        archive.finalize()
      })
    },
    catch: (error) =>
      new ZipProcessingError({
        message: "Failed to create archive",
        jobId,
        processId: chunkState.processId,
        cause: error,
      }),
  })

  // Upload final zip to S3
  yield* s3Service.putFile(zipsBucket, chunkState.zipKey, archiveBuffer)

  yield* Effect.logInfo({
    message: "Successfully created and uploaded combined zip",
    jobId,
    zipKey: chunkState.zipKey,
    zippedSubmissionsCount: zippedSubmissions.length,
    archiveSize: archiveBuffer.length,
  })

  // Atomically increment completed chunks counter
  const incrementResult = yield* downloadStateRepository.atomicIncrementCompleted(
    chunkState.processId,
    chunkState.totalChunks
  )

  yield* Effect.logInfo({
    message: "Updated download process state atomically",
    processId: chunkState.processId,
    completedChunks: incrementResult.completedChunks,
    failedChunks: incrementResult.failedChunks,
    status: incrementResult.status,
  })

  return {
    jobId,
    zipKey: chunkState.zipKey,
    zippedSubmissionsCount: zippedSubmissions.length,
    archiveSize: archiveBuffer.length,
    processId: chunkState.processId,
    status: incrementResult.status,
  }
}).pipe(Effect.withSpan("zip-downloader.processJob"))

/**
 * Handle job failure by atomically incrementing the failed chunks counter
 */
const handleJobFailure = (
  jobId: string,
  processId: string | undefined,
  totalChunks: number,
  error: unknown
) =>
  Effect.gen(function* () {
    const downloadStateRepository = yield* DownloadStateRepository

    if (processId) {
      yield* Effect.logError({
        message: "Job failed, marking chunk as failed",
        jobId,
        processId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Atomically increment failed chunks counter
      const result = yield* downloadStateRepository
        .atomicIncrementFailed(processId, totalChunks, jobId)
        .pipe(
          Effect.catchAll((redisError) =>
            Effect.gen(function* () {
              yield* Effect.logError({
                message: "Failed to update failed chunks counter",
                jobId,
                processId,
                error: redisError instanceof Error ? redisError.message : String(redisError),
              })
              return { completedChunks: 0, failedChunks: 0, status: "failed" as const }
            })
          )
        )

      yield* Effect.logInfo({
        message: "Updated download process state after failure",
        processId,
        completedChunks: result.completedChunks,
        failedChunks: result.failedChunks,
        status: result.status,
      })
    } else {
      yield* Effect.logError({
        message: "Job failed but no processId available to update",
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

const mainLayer = Layer.mergeAll(
  Database.Default,
  DownloadStateRepository.Default,
  RedisClient.Default,
  S3Service.Default,
  TelemetryLayer("blikka-dev-zip-downloader")
)

const runnable = processJob.pipe(
  Effect.provide(mainLayer),
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      const jobId = yield* parseJobId.pipe(Effect.orElseSucceed(() => "unknown"))

      // Extract processId and totalChunks from error context if available
      let processId: string | undefined
      let totalChunks = 1 // Default, will be overwritten if we can get the real value

      if (error instanceof ProcessCancelledError) {
        // Process was cancelled, no need to mark as failed
        yield* Effect.logWarning({
          message: "Job skipped due to process cancellation",
          jobId: error.jobId,
          processId: error.processId,
        })
        return
      }

      if (error instanceof ChunkStateNotFoundError) {
        // Can't do anything without chunk state
        yield* Effect.logError({
          message: "Chunk state not found, cannot update process",
          jobId: error.jobId,
        })
        return yield* Effect.die(error)
      }

      if (error instanceof ZipProcessingError) {
        processId = error.processId
      }

      // Try to get chunk state for processId and totalChunks
      if (!processId) {
        const downloadStateRepository = yield* DownloadStateRepository
        const chunkStateOption = yield* downloadStateRepository
          .getChunkState(jobId)
          .pipe(Effect.catchAll(() => Effect.succeed(Option.none())))
        if (Option.isSome(chunkStateOption)) {
          processId = chunkStateOption.value.processId
          totalChunks = chunkStateOption.value.totalChunks
        }
      }

      yield* handleJobFailure(jobId, processId, totalChunks, error).pipe(Effect.provide(mainLayer))

      return yield* Effect.die(error)
    }).pipe(Effect.withSpan("zip-downloader.handleJobFailure"), Effect.provide(mainLayer))
  )
)

Effect.runPromise(runnable)
