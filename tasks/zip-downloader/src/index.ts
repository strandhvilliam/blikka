import { Config, Effect, Schema, Option, Layer } from 'effect'
import { ZippedSubmissionsRepository, ZippedSubmissionsRepositoryLayer } from '@blikka/db'
import { DownloadStateRepository, DownloadStateRepositoryLayer } from '@blikka/kv-store'
import { TelemetryLayer } from '@blikka/telemetry'
import { S3Service, S3ServiceLayer } from '@blikka/aws'
import archiver from 'archiver'
import JSZip from 'jszip'

class ProcessCancelledError extends Schema.TaggedErrorClass<ProcessCancelledError>()(
  'ProcessCancelledError',
  {
    processId: Schema.String,
    jobId: Schema.String,
  },
) {}

class ChunkStateNotFoundError extends Schema.TaggedErrorClass<ChunkStateNotFoundError>()(
  'ChunkStateNotFoundError',
  {
    jobId: Schema.String,
  },
) {}

class ZipProcessingError extends Schema.TaggedErrorClass<ZipProcessingError>()(
  'ZipProcessingError',
  {
    message: Schema.String,
    jobId: Schema.String,
    processId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

const parseJobId = Effect.gen(function* () {
  const jobId = yield* Config.string('JOB_ID')
  return jobId
}).pipe(
  Effect.mapError(
    (error) => new Error(`Failed to parse JOB_ID environment variable: ${String(error)}`),
  ),
)

const processJob = Effect.gen(function* () {
  const downloadStateRepository = yield* DownloadStateRepository
  const s3Service = yield* S3Service
  const zippedSubmissionsQueries = yield* ZippedSubmissionsRepository
  const zipsBucket = yield* Config.string('ZIPS_BUCKET_NAME')

  const jobId = yield* parseJobId

  yield* Effect.logInfo({
    message: 'Starting zip download job processing',
    jobId,
  })

  const chunkStateOption = yield* downloadStateRepository.getChunkState(jobId)

  yield* Effect.logInfo({
    message: 'Chunk state',
    chunkStateOption,
  })

  if (Option.isNone(chunkStateOption)) {
    return yield* Effect.fail(new ChunkStateNotFoundError({ jobId }))
  }

  const chunkState = chunkStateOption.value
  const { processId, processTotalChunks } = chunkState

  yield* Effect.logInfo({
    message: 'Retrieved chunk state from Redis',
    jobId,
    processId: chunkState.processId,
    domain: chunkState.domain,
    competitionClassId: chunkState.competitionClassId,
    minReference: chunkState.minReference,
    maxReference: chunkState.maxReference,
    zipKey: chunkState.zipKey,
    processTotalChunks,
  })

  // Check if the process is still active (not cancelled)
  const isActive = yield* downloadStateRepository.isProcessActive(chunkState.processId)
  if (!isActive) {
    yield* Effect.logWarning({
      message: 'Process is no longer active (cancelled or failed), skipping job',
      jobId,
      processId: chunkState.processId,
    })
    return yield* Effect.fail(new ProcessCancelledError({ processId: chunkState.processId, jobId }))
  }

  // Query zippedSubmissions for the chunk using reference range
  const zippedSubmissions = yield* zippedSubmissionsQueries.getZippedSubmissionsByReferenceRange({
    domain: chunkState.domain,
    competitionClassId: chunkState.competitionClassId,
    minReference: chunkState.minReference,
    maxReference: chunkState.maxReference,
  })

  yield* Effect.logInfo({
    message: 'Retrieved zippedSubmissions for chunk',
    jobId,
    zipKey: chunkState.zipKey,
    zippedSubmissionsCount: zippedSubmissions.length,
    minReference: chunkState.minReference,
    maxReference: chunkState.maxReference,
  })

  if (zippedSubmissions.length === 0) {
    yield* Effect.logWarning({
      message: 'No zippedSubmissions to process, marking as completed',
      jobId,
      zipKey: chunkState.zipKey,
    })

    yield* downloadStateRepository.atomicIncrementCompleted(processId, processTotalChunks)

    return {
      jobId,
      zipKey: chunkState.zipKey,
      zippedSubmissionsCount: 0,
      message: 'No zippedSubmissions to process',
      archiveSize: 0,
      processId: chunkState.processId,
    }
  }

  yield* Effect.logInfo({
    message: 'Starting zip processing',
    jobId,
    zipKey: chunkState.zipKey,
    zippedSubmissionsCount: zippedSubmissions.length,
    zipsBucket,
  })

  // Process each participant zip and collect file data
  const processParticipantZip = Effect.fn('processParticipantZip')(function* (
    zippedSubmission: (typeof zippedSubmissions)[0],
  ) {
    const participantReference = zippedSubmission.participant.reference
    const zipKey = zippedSubmission.key

    yield* Effect.logInfo({
      message: 'Processing participant zip',
      jobId,
      participantReference,
      zipKey,
    })

    // Download participant zip from S3
    const zipFileOption = yield* s3Service.getFile(zipsBucket, zipKey)

    if (Option.isNone(zipFileOption)) {
      yield* Effect.logError({
        message: 'Failed to download participant zip from S3',
        jobId,
        participantReference,
        zipKey,
      })
      return yield* Effect.fail(
        new ZipProcessingError({
          message: `Failed to download zip for participant ${participantReference}: ${zipKey}`,
          jobId,
          processId: chunkState.processId,
        }),
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
            const fileData = await file.async('nodebuffer')
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
      message: 'Completed processing participant zip',
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
      message: 'Process cancelled during processing, aborting upload',
      jobId,
      processId: chunkState.processId,
    })
    return yield* Effect.fail(new ProcessCancelledError({ processId: chunkState.processId, jobId }))
  }

  // Create final zip with archiver
  const archiveBuffer = yield* Effect.tryPromise({
    try: () => {
      return new Promise<Buffer>((resolve, reject) => {
        const archive = archiver('zip', {
          zlib: { level: 6 },
        })

        const chunks: Buffer[] = []
        archive.on('data', (chunk: Buffer) => chunks.push(chunk))
        archive.on('end', () => resolve(Buffer.concat(chunks)))
        archive.on('error', reject)

        for (const file of allFiles) {
          archive.append(file.data, { name: file.path })
        }

        archive.finalize()
      })
    },
    catch: (error) =>
      new ZipProcessingError({
        message: 'Failed to create archive',
        jobId,
        processId: chunkState.processId,
        cause: error,
      }),
  })

  yield* s3Service.putFile(zipsBucket, chunkState.zipKey, archiveBuffer)

  yield* Effect.logInfo({
    message: 'Successfully created and uploaded combined zip',
    jobId,
    zipKey: chunkState.zipKey,
    zippedSubmissionsCount: zippedSubmissions.length,
    archiveSize: archiveBuffer.length,
  })

  const incrementResult = yield* downloadStateRepository.atomicIncrementCompleted(
    processId,
    processTotalChunks,
  )

  yield* Effect.logInfo({
    message: 'Updated download process state atomically',
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
}).pipe(Effect.withSpan('zip-downloader.processJob'))

const handleJobFailure = (
  jobId: string,
  processId: string,
  processTotalChunks: number,
  error: unknown,
) =>
  Effect.gen(function* () {
    const downloadStateRepository = yield* DownloadStateRepository

    yield* Effect.logError({
      message: 'Job failed, marking chunk as failed',
      jobId,
      processId,
      error: error instanceof Error ? error.message : String(error),
    })

    const result = yield* downloadStateRepository
      .atomicIncrementFailed(processId, processTotalChunks, jobId)
      .pipe(
        Effect.catch((redisError) =>
          Effect.gen(function* () {
            yield* Effect.logError({
              message: 'Failed to update failed chunks counter',
              jobId,
              processId,
              error: redisError instanceof Error ? redisError.message : String(redisError),
            })
            return { completedChunks: 0, failedChunks: 0, status: 'failed' as const }
          }),
        ),
      )

    yield* Effect.logInfo({
      message: 'Updated download process state after failure',
      processId,
      completedChunks: result.completedChunks,
      failedChunks: result.failedChunks,
      status: result.status,
    })
  })

const mainLayer = Layer.mergeAll(
  ZippedSubmissionsRepositoryLayer,
  DownloadStateRepositoryLayer,
  S3ServiceLayer,
  TelemetryLayer('blikka-dev-zip-downloader'),
)

const runnable = processJob.pipe(
  Effect.provide(mainLayer),
  Effect.catch((error) =>
    Effect.gen(function* () {
      const jobId = yield* parseJobId.pipe(Effect.orElseSucceed(() => 'unknown'))

      if (error instanceof ProcessCancelledError) {
        yield* Effect.logWarning({
          message: 'Job skipped due to process cancellation',
          jobId: error.jobId,
          processId: error.processId,
        })
        return
      }

      if (error instanceof ChunkStateNotFoundError) {
        yield* Effect.logError({
          message: 'Chunk state not found, cannot update process',
          jobId: error.jobId,
        })
        return yield* Effect.die(error)
      }

      const downloadStateRepository = yield* DownloadStateRepository
      const chunkStateOption = yield* downloadStateRepository
        .getChunkState(jobId)
        .pipe(Effect.catch(() => Effect.succeed(Option.none())))

      if (Option.isSome(chunkStateOption)) {
        const { processId, processTotalChunks } = chunkStateOption.value
        yield* handleJobFailure(jobId, processId, processTotalChunks, error).pipe(
          Effect.provide(mainLayer),
        )
      } else {
        yield* Effect.logError({
          message: 'Job failed but chunk state unavailable to update process',
          jobId,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      return yield* Effect.die(error)
    }).pipe(Effect.withSpan('zip-downloader.handleJobFailure'), Effect.provide(mainLayer)),
  ),
)

Effect.runPromise(runnable)
