import { Config, Effect, Schema, Option, Layer } from "effect"
import { DownloadStateManager } from "./download-state-manager"
import { Database } from "@blikka/db"
import { RedisClient } from "@blikka/redis"
import { TelemetryLayer } from "@blikka/telemetry"
import { S3Service } from "@blikka/s3"
import { Resource as SSTResource } from "sst"
import archiver from "archiver"
import JSZip from "jszip"

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
  const downloadStateManager = yield* DownloadStateManager

  // Read JOB_ID from environment variable
  const jobId = yield* parseJobId

  yield* Effect.logInfo({
    message: "Starting zip download job processing",
    jobId,
  })

  // Retrieve chunk state from Redis
  const chunkStateOption = yield* downloadStateManager.getChunkState(jobId)

  if (Option.isNone(chunkStateOption)) {
    return yield* Effect.fail(new Error(`Chunk state not found for jobId: ${jobId}`))
  }

  const chunkState = chunkStateOption.value

  yield* Effect.logInfo({
    message: "Retrieved chunk state from Redis",
    jobId,
    domain: chunkState.domain,
    competitionClassId: chunkState.competitionClassId,
    minReference: chunkState.minReference,
    maxReference: chunkState.maxReference,
    zipKey: chunkState.zipKey,
  })

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
      message: "No zippedSubmissions to process",
      jobId,
      zipKey: chunkState.zipKey,
    })
    return yield* Effect.succeed({
      jobId,
      zipKey: chunkState.zipKey,
      zippedSubmissionsCount: 0,
      message: "No zippedSubmissions to process",
      archiveSize: 0,
      processId: chunkState.processId,
    })
  }

  const s3Service = yield* S3Service
  const zipsBucket = yield* Config.string("ZIPS_BUCKET_NAME")

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
        new Error(`Failed to download zip for participant ${participantReference}: ${zipKey}`)
      )
    }

    const zipBuffer = Buffer.from(zipFileOption.value)

    // Load zip with JSZip and extract files
    const participantZip = yield* Effect.tryPromise({
      try: () => JSZip.loadAsync(zipBuffer),
      catch: (error) =>
        new Error(`Failed to load zip for participant ${participantReference}: ${String(error)}`),
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
        new Error(
          `Failed to extract files for participant ${participantReference}: ${String(error)}`
        ),
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
  }).pipe(
    Effect.map((results) => results.flat()),
    Effect.catchAll((error) =>
      Effect.fail(
        new Error(
          `Failed to process participant zips: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    )
  )

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
    catch: (error) => new Error(`Failed to create archive: ${String(error)}`),
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

  // Update process state - mark this chunk as completed
  const processStateOption = yield* downloadStateManager.getDownloadProcess(chunkState.processId)
  if (Option.isSome(processStateOption)) {
    const processState = processStateOption.value
    const updatedCompletedChunks = processState.completedChunks + 1
    const allChunksCompleted = updatedCompletedChunks >= processState.totalChunks

    yield* downloadStateManager.updateDownloadProcess(chunkState.processId, {
      completedChunks: updatedCompletedChunks,
      status: allChunksCompleted ? "completed" : "processing",
    })

    yield* Effect.logInfo({
      message: "Updated download process state",
      processId: chunkState.processId,
      completedChunks: updatedCompletedChunks,
      totalChunks: processState.totalChunks,
      status: allChunksCompleted ? "completed" : "processing",
    })
  }

  return {
    jobId,
    zipKey: chunkState.zipKey,
    zippedSubmissionsCount: zippedSubmissions.length,
    archiveSize: archiveBuffer.length,
    processId: chunkState.processId,
  }
})

const mainLayer = Layer.mergeAll(
  Database.Default,
  DownloadStateManager.Default,
  RedisClient.Default,
  S3Service.Default,
  TelemetryLayer("blikka-dev-zip-downloader")
)

const runnable = processJob.pipe(
  Effect.provide(mainLayer),
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      const errorMessage = error instanceof Error ? error.message : String(error)
      yield* Effect.logError({
        message: "Error processing zip download job",
        error: errorMessage,
        cause: error,
      })
      return yield* Effect.die(error)
    })
  )
)

Effect.runPromise(runnable)
