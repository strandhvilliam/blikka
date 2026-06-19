import { S3Service, S3ServiceLayer } from '@blikka/aws'
import { ZippedSubmissionsRepository, ZippedSubmissionsRepositoryLayer } from '@blikka/db'
import { DownloadStateRepository, DownloadStateRepositoryLayer } from '@blikka/kv-store'
import { Context, Duration, Effect, Layer, Option, Schedule, Schema } from 'effect'
import archiver from 'archiver'
import JSZip from 'jszip'
import { UploadsConfig, UploadsConfigLayer } from './config'
import { EnsureParticipantZip, EnsureParticipantZipLayer } from './ensure-participant-zip'

export class ProcessCancelledError extends Schema.TaggedErrorClass<ProcessCancelledError>()(
  'ProcessCancelledError',
  {
    processId: Schema.String,
    jobId: Schema.String,
  },
) {}

export class ChunkStateNotFoundError extends Schema.TaggedErrorClass<ChunkStateNotFoundError>()(
  'ChunkStateNotFoundError',
  {
    jobId: Schema.String,
  },
) {}

export class ZipProcessingError extends Schema.TaggedErrorClass<ZipProcessingError>()(
  'ZipProcessingError',
  {
    message: Schema.String,
    jobId: Schema.String,
    processId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ZipDownloader extends Context.Service<
  ZipDownloader,
  {
    /**
     * Runs a single zip-download chunk job: reads the chunk state, generates any missing
     * per-participant zips (lazily, from originals), merges them into the chunk archive streamed
     * to S3, and updates the download process counters. Records the chunk as failed if any
     * participant fails; dies (non-zero exit) on unrecoverable errors so the task surfaces failure.
     */
    readonly runJob: (jobId: string) => Effect.Effect<void>
  }
>()('@blikka/uploads/ZipDownloader') {}

/**
 * Surfaces the real failure reason for logging. Our tagged errors (S3ClientError,
 * DownloadStateScriptFailed, ...) carry a generic `message` and stash the underlying SDK/Redis
 * error in `cause`; logging only `message` hides what actually went wrong (timeout vs SlowDown vs
 * connection reset vs access denied). This pulls out the cause's name + message too.
 */
const describeError = (error: unknown): Record<string, unknown> => {
  if (!(error instanceof Error)) {
    return { error: String(error) }
  }

  const cause = (error as { cause?: unknown }).cause

  return {
    error: error.message,
    errorName: error.name,
    cause:
      cause instanceof Error
        ? { name: cause.name, message: cause.message }
        : cause !== undefined
          ? String(cause)
          : undefined,
  }
}

const makeZipDownloader = Effect.gen(function* () {
  const downloadStateRepository = yield* DownloadStateRepository
  const s3Service = yield* S3Service
  const zippedSubmissionsQueries = yield* ZippedSubmissionsRepository
  const ensureParticipantZip = yield* EnsureParticipantZip
  const config = yield* UploadsConfig
  const zipsBucket = config.zipsBucketName

  const processJob = (jobId: string) =>
    Effect.gen(function* () {
      yield* Effect.logInfo({ message: 'Starting zip download job processing', jobId })

      const chunkStateOption = yield* downloadStateRepository.getChunkState(jobId)

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
        return yield* Effect.fail(
          new ProcessCancelledError({ processId: chunkState.processId, jobId }),
        )
      }

      // Enumerate completed participants in the chunk's reference range. Zips are generated lazily,
      // so we drive from participants (not pre-existing zip rows) and build any that are missing.
      const references = yield* zippedSubmissionsQueries.getParticipantReferencesInRange({
        domain: chunkState.domain,
        competitionClassId: chunkState.competitionClassId,
        minReference: chunkState.minReference,
        maxReference: chunkState.maxReference,
      })

      yield* Effect.logInfo({
        message: 'Retrieved participants for chunk',
        jobId,
        zipKey: chunkState.zipKey,
        participantCount: references.length,
        minReference: chunkState.minReference,
        maxReference: chunkState.maxReference,
      })

      if (references.length === 0) {
        yield* Effect.logWarning({
          message: 'No participants to process, marking as completed',
          jobId,
          zipKey: chunkState.zipKey,
        })

        yield* downloadStateRepository.atomicIncrementCompleted(
          processId,
          processTotalChunks,
          jobId,
        )
        return
      }

      yield* Effect.logInfo({
        message: 'Starting zip processing',
        jobId,
        zipKey: chunkState.zipKey,
        participantCount: references.length,
        zipsBucket,
      })

      // For each participant: ensure their zip exists (generate-on-miss, reusing the cached zip),
      // then load it and collect its files. Each participant yields a tagged ok/failure result so
      // the forEach never aborts mid-way; we then fail the whole chunk if ANY participant failed,
      // rather than silently shipping a partial archive that reports as completed.
      const processParticipant = (reference: string) =>
        Effect.gen(function* () {
          const { key: zipKey, generated } = yield* ensureParticipantZip.ensureParticipantZip({
            domain: chunkState.domain,
            reference,
          })

          yield* Effect.logInfo({
            message: 'Processing participant zip',
            jobId,
            reference,
            zipKey,
            generated,
          })

          const zipFileOption = yield* s3Service.getFile(zipsBucket, zipKey)

          if (Option.isNone(zipFileOption)) {
            return yield* Effect.fail(
              new ZipProcessingError({
                message: `Failed to download zip for participant ${reference}: ${zipKey}`,
                jobId,
                processId: chunkState.processId,
              }),
            )
          }

          const zipBuffer = Buffer.from(zipFileOption.value)

          const participantZip = yield* Effect.tryPromise({
            try: () => JSZip.loadAsync(zipBuffer),
            catch: (error) =>
              new ZipProcessingError({
                message: `Failed to load zip for participant ${reference}`,
                jobId,
                processId: chunkState.processId,
                cause: error,
              }),
          })

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
                    path: `${reference}/${relativePath}`,
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
                message: `Failed to extract files for participant ${reference}`,
                jobId,
                processId: chunkState.processId,
                cause: error,
              }),
          })

          yield* Effect.logInfo({
            message: 'Completed processing participant zip',
            jobId,
            reference,
            zipKey,
            filesCount: files.length,
          })

          return files
        }).pipe(
          Effect.map((files) => ({ ok: true as const, reference, files })),
          // Capture (don't rethrow) per-participant failures so we can report EVERY failing
          // participant; the chunk is failed as a whole below so a partial archive is never published.
          Effect.catch((error) =>
            Effect.logError({
              message: 'Failed to process participant zip',
              jobId,
              reference,
              error: error instanceof Error ? error.message : String(error),
            }).pipe(Effect.as({ ok: false as const, reference })),
          ),
          Effect.withSpan('processParticipant'),
        )

      // Nested concurrency: this fans out 3 participants, each of which downloads its originals at
      // concurrency 5 inside ensureParticipantZip — keep this modest to bound in-flight S3 reads.
      const results = yield* Effect.forEach(references, processParticipant, {
        concurrency: 3,
      })

      const failedReferences = results
        .filter((result) => !result.ok)
        .map((result) => result.reference)

      if (failedReferences.length > 0) {
        // Fail the chunk so it is recorded as failed (handleJobFailure -> atomicIncrementFailed)
        // and never surfaced as a completed download that is silently missing participants.
        return yield* Effect.fail(
          new ZipProcessingError({
            message: `Failed to process ${failedReferences.length}/${references.length} participant(s) in chunk: ${failedReferences.join(', ')}`,
            jobId,
            processId: chunkState.processId,
          }),
        )
      }

      const allFiles = results.flatMap((result) => (result.ok ? result.files : []))

      // Check again if the process is still active before uploading
      const stillActive = yield* downloadStateRepository.isProcessActive(chunkState.processId)
      if (!stillActive) {
        yield* Effect.logWarning({
          message: 'Process cancelled during processing, aborting upload',
          jobId,
          processId: chunkState.processId,
        })
        return yield* Effect.fail(
          new ProcessCancelledError({ processId: chunkState.processId, jobId }),
        )
      }

      // Stream the combined archive straight to S3 (multipart) so the full zip is never buffered in
      // memory. The upload consumes the archive stream as it is produced (producer/consumer run
      // concurrently with stream backpressure); only `allFiles` plus small in-flight parts are held.
      //
      // The whole build-and-upload is wrapped in a retry because multipart streaming uploads to S3
      // hit transient errors routinely (connection resets, `SlowDown`/503 throttling). The archiver
      // Body is a one-shot Readable that is consumed and destroyed per attempt, so the archive MUST
      // be (re)created INSIDE the retried effect — retrying `uploadStream` alone would re-send an
      // already-drained stream. We only retry transient S3 failures; a ZipProcessingError (archive
      // build failure) is deterministic and is surfaced immediately. A new multipart upload to the
      // same key on each attempt is safe (last writer wins).
      const archiveSize = yield* Effect.gen(function* () {
        const archive = archiver('zip', {
          zlib: { level: 6 },
        })

        // Attach an 'error' listener so an archiver error is never thrown as an unhandled 'error'
        // event (which would crash the task instead of failing the chunk). The failure still surfaces
        // because the upload effect rejects when the stream errors.
        archive.on('error', () => {})

        yield* Effect.all(
          [
            s3Service.uploadStream(zipsBucket, chunkState.zipKey, archive, {
              contentType: 'application/zip',
            }),
            Effect.tryPromise({
              try: async () => {
                for (const file of allFiles) {
                  archive.append(file.data, { name: file.path })
                }
                await archive.finalize()
              },
              catch: (error) => {
                // Tear the stream down so the in-flight multipart upload fails fast instead of hanging.
                archive.destroy(error instanceof Error ? error : new Error(String(error)))
                return new ZipProcessingError({
                  message: 'Failed to create archive',
                  jobId,
                  processId: chunkState.processId,
                  cause: error,
                })
              },
            }),
          ],
          { concurrency: 'unbounded', discard: true },
        ).pipe(
          // Always destroy the archive when the combined op ends. Critically, if the UPLOAD side
          // fails, the producer fiber is interrupted but the archive would otherwise be left
          // undrained — this releases it. No-op on the success path (the stream has already ended).
          Effect.ensuring(
            Effect.sync(() => {
              if (!archive.destroyed) {
                archive.destroy()
              }
            }),
          ),
        )

        return archive.pointer()
      }).pipe(
        Effect.tapError((error) =>
          Effect.logWarning({
            message: 'Combined zip upload attempt failed',
            jobId,
            zipKey: chunkState.zipKey,
            ...describeError(error),
          }),
        ),
        Effect.retry({
          while: (error) => error._tag === 'S3ClientError',
          schedule: Schedule.both(Schedule.exponential(Duration.millis(200)), Schedule.recurs(3)),
        }),
      )

      yield* Effect.logInfo({
        message: 'Successfully created and uploaded combined zip',
        jobId,
        zipKey: chunkState.zipKey,
        participantCount: references.length,
        archiveSize,
      })

      const incrementResult = yield* downloadStateRepository.atomicIncrementCompleted(
        processId,
        processTotalChunks,
        jobId,
      )

      yield* Effect.logInfo({
        message: 'Updated download process state atomically',
        processId: chunkState.processId,
        completedChunks: incrementResult.completedChunks,
        failedChunks: incrementResult.failedChunks,
        status: incrementResult.status,
      })
    }).pipe(Effect.withSpan('zip-downloader.processJob'))

  const handleJobFailure = (
    jobId: string,
    processId: string,
    processTotalChunks: number,
    error: unknown,
  ) =>
    Effect.gen(function* () {
      yield* Effect.logError({
        message: 'Job failed, marking chunk as failed',
        jobId,
        processId,
        ...describeError(error),
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
                ...describeError(redisError),
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

  const runJob: ZipDownloader['Service']['runJob'] = (jobId) =>
    processJob(jobId).pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
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

          const chunkStateOption = yield* downloadStateRepository
            .getChunkState(jobId)
            .pipe(Effect.catch(() => Effect.succeed(Option.none())))

          if (Option.isSome(chunkStateOption)) {
            const { processId, processTotalChunks } = chunkStateOption.value
            yield* handleJobFailure(jobId, processId, processTotalChunks, error)
          } else {
            yield* Effect.logError({
              message: 'Job failed but chunk state unavailable to update process',
              jobId,
              ...describeError(error),
            })
          }

          return yield* Effect.die(error)
        }).pipe(Effect.withSpan('zip-downloader.handleJobFailure')),
      ),
    )

  return ZipDownloader.of({ runJob })
})

export const ZipDownloaderLayerNoDeps = Layer.effect(ZipDownloader, makeZipDownloader)

export const ZipDownloaderLayer = ZipDownloaderLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(
      DownloadStateRepositoryLayer,
      ZippedSubmissionsRepositoryLayer,
      S3ServiceLayer,
      EnsureParticipantZipLayer,
      UploadsConfigLayer,
    ),
  ),
)
