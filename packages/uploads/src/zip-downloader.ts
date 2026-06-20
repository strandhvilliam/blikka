import { S3Service, S3ServiceLayer } from '@blikka/aws'
import {
  ExportJobsRepository,
  ExportJobsRepositoryLayer,
  ZippedSubmissionsRepository,
  ZippedSubmissionsRepositoryLayer,
} from '@blikka/db'
import { Context, Duration, Effect, Layer, Option, Schedule, Schema } from 'effect'
import archiver from 'archiver'
import JSZip from 'jszip'
import { PassThrough } from 'node:stream'
import { UploadsConfig, UploadsConfigLayer } from './config'
import { EnsureParticipantZip, EnsureParticipantZipLayer } from './ensure-participant-zip'

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
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ZipDownloader extends Context.Service<
  ZipDownloader,
  {
    /**
     * Runs a single zip-download chunk job: reads the chunk row by id, generates any missing
     * per-participant zips (lazily, from originals), merges them into the chunk archive streamed
     * to S3, and updates the chunk + parent job status in Postgres. Records the chunk as failed if
     * any participant fails; dies (non-zero exit) on unrecoverable errors so the task surfaces failure.
     */
    readonly runJob: (jobId: string) => Effect.Effect<void>
  }
>()('@blikka/uploads/ZipDownloader') {}

/**
 * Surfaces the real failure reason for logging. Our tagged errors (S3ClientError, ...) carry a
 * generic `message` and stash the underlying SDK error in `cause` — and those wrap further
 * (S3ClientError -> S3EffectError -> the real AWS SDK error). Logging only the top `message` hides
 * what actually went wrong, so this walks the full `cause` chain and pulls out AWS-specific fields
 * (name, error code, HTTP status, fault) so the underlying error (AccessDenied, NoSuchBucket,
 * CredentialsProviderError, timeout, ...) is visible.
 */
const errorDetail = (error: unknown, depth = 0): Record<string, unknown> => {
  if (depth > 6) {
    return { truncated: true }
  }
  if (!(error instanceof Error)) {
    return { value: String(error) }
  }

  const err = error as Error & {
    code?: string
    Code?: string
    $fault?: unknown
    $metadata?: { httpStatusCode?: number; requestId?: string }
    cause?: unknown
  }

  const detail: Record<string, unknown> = {
    name: err.name,
    message: err.message,
  }
  if (err.code !== undefined) detail.code = err.code
  if (err.Code !== undefined) detail.Code = err.Code
  if (err.$fault !== undefined) detail.fault = err.$fault
  if (err.$metadata?.httpStatusCode !== undefined) {
    detail.httpStatusCode = err.$metadata.httpStatusCode
  }
  if (err.$metadata?.requestId !== undefined) detail.requestId = err.$metadata.requestId
  if (err.cause !== undefined) detail.cause = errorDetail(err.cause, depth + 1)

  return detail
}

const describeError = (error: unknown): Record<string, unknown> => ({
  error: error instanceof Error ? error.message : String(error),
  errorName: error instanceof Error ? error.name : undefined,
  detail: errorDetail(error),
})

const makeZipDownloader = Effect.gen(function* () {
  const exportJobsRepository = yield* ExportJobsRepository
  const s3Service = yield* S3Service
  const zippedSubmissionsQueries = yield* ZippedSubmissionsRepository
  const ensureParticipantZip = yield* EnsureParticipantZip
  const config = yield* UploadsConfig
  const zipsBucket = config.zipsBucketName

  const processJob = (jobId: string) =>
    Effect.gen(function* () {
      yield* Effect.logInfo({ message: 'Starting zip download job processing', jobId })

      const chunkId = Number(jobId)
      const contextOption = yield* exportJobsRepository.getChunkWithDomain({ chunkId })

      if (Option.isNone(contextOption)) {
        return yield* Effect.fail(new ChunkStateNotFoundError({ jobId }))
      }

      const { chunk, domain } = contextOption.value

      yield* Effect.logInfo({
        message: 'Retrieved chunk row from DB',
        jobId,
        exportJobId: chunk.exportJobId,
        domain,
        competitionClassId: chunk.competitionClassId,
        minReference: chunk.minReference,
        maxReference: chunk.maxReference,
        zipKey: chunk.zipKey,
      })

      // Mark the chunk as building so the dashboard reflects in-flight work.
      yield* exportJobsRepository.setChunkStatus({ chunkId, status: 'building' })

      // Enumerate completed participants in the chunk's reference range. Zips are generated lazily,
      // so we drive from participants (not pre-existing zip rows) and build any that are missing.
      const references = yield* zippedSubmissionsQueries.getParticipantReferencesInRange({
        domain,
        competitionClassId: chunk.competitionClassId,
        minReference: chunk.minReference,
        maxReference: chunk.maxReference,
      })

      yield* Effect.logInfo({
        message: 'Retrieved participants for chunk',
        jobId,
        zipKey: chunk.zipKey,
        participantCount: references.length,
        minReference: chunk.minReference,
        maxReference: chunk.maxReference,
      })

      if (references.length === 0) {
        yield* Effect.logWarning({
          message: 'No participants to process, marking chunk ready',
          jobId,
          zipKey: chunk.zipKey,
        })

        yield* exportJobsRepository.applyChunkResult({ chunkId, status: 'ready' })
        return
      }

      yield* Effect.logInfo({
        message: 'Starting zip processing',
        jobId,
        zipKey: chunk.zipKey,
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
            domain,
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
        // Fail the chunk so it is recorded as failed and never surfaced as a completed download
        // that is silently missing participants.
        return yield* Effect.fail(
          new ZipProcessingError({
            message: `Failed to process ${failedReferences.length}/${references.length} participant(s) in chunk: ${failedReferences.join(', ')}`,
            jobId,
          }),
        )
      }

      const allFiles = results.flatMap((result) => (result.ok ? result.files : []))

      // Stream the combined archive straight to S3 (multipart) so the full zip is never buffered in
      // memory. The upload consumes the archive stream as it is produced (producer/consumer run
      // concurrently with stream backpressure); only `allFiles` plus small in-flight parts are held.
      //
      // The whole build-and-upload is wrapped in a retry because multipart streaming uploads to S3
      // hit transient errors routinely (connection resets, `SlowDown`/503 throttling). The streams
      // are one-shot (consumed and destroyed per attempt), so they MUST be (re)created INSIDE the
      // retried effect — retrying `uploadStream` alone would re-send an already-drained stream. We
      // only retry transient S3 failures; a ZipProcessingError (archive build failure) is
      // deterministic and is surfaced immediately. A new multipart upload to the same key on each
      // attempt is safe (last writer wins).
      const archiveSize = yield* Effect.gen(function* () {
        const archive = archiver('zip', {
          zlib: { level: 6 },
        })

        // `@aws-sdk/lib-storage`'s `Upload` only accepts a NATIVE node stream as its Body. Archiver
        // (v7) builds on the userland `readable-stream` package, so its output fails the SDK's
        // `instanceof Readable` check and is rejected outright with "Body Data is unsupported format"
        // — deterministically, before any bytes are sent. Pipe the archive through a native
        // PassThrough and upload THAT so the SDK accepts the Body.
        const uploadBody = new PassThrough()

        // Forward archiver errors onto the upload body: this both stops an archiver error from being
        // thrown as an unhandled 'error' event (which would crash the task) AND tears the upload body
        // down so the in-flight multipart upload rejects fast instead of hanging.
        archive.on('error', (error) => {
          if (!uploadBody.destroyed) {
            uploadBody.destroy(error instanceof Error ? error : new Error(String(error)))
          }
        })
        archive.pipe(uploadBody)

        yield* Effect.all(
          [
            s3Service.uploadStream(zipsBucket, chunk.zipKey, uploadBody, {
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
                // Tear both streams down so the in-flight multipart upload fails fast instead of hanging.
                const cause = error instanceof Error ? error : new Error(String(error))
                archive.destroy(cause)
                if (!uploadBody.destroyed) {
                  uploadBody.destroy(cause)
                }
                return new ZipProcessingError({
                  message: 'Failed to create archive',
                  jobId,
                  cause: error,
                })
              },
            }),
          ],
          { concurrency: 'unbounded', discard: true },
        ).pipe(
          // Always destroy both streams when the combined op ends. Critically, if the UPLOAD side
          // fails, the producer fiber is interrupted but the streams would otherwise be left
          // undrained — this releases them. No-op on the success path (the streams have already ended).
          Effect.ensuring(
            Effect.sync(() => {
              if (!archive.destroyed) {
                archive.destroy()
              }
              if (!uploadBody.destroyed) {
                uploadBody.destroy()
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
            zipKey: chunk.zipKey,
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
        zipKey: chunk.zipKey,
        participantCount: references.length,
        archiveSize,
      })

      const job = yield* exportJobsRepository.applyChunkResult({ chunkId, status: 'ready' })

      yield* Effect.logInfo({
        message: 'Marked chunk ready and recomputed export job',
        exportJobId: chunk.exportJobId,
        status: Option.map(job, (j) => j.status).pipe(Option.getOrElse(() => 'unknown')),
      })
    }).pipe(Effect.withSpan('zip-downloader.processJob'))

  const handleJobFailure = (jobId: string, error: unknown) =>
    Effect.gen(function* () {
      yield* Effect.logError({
        message: 'Job failed, marking chunk as failed',
        jobId,
        ...describeError(error),
      })

      yield* exportJobsRepository
        .applyChunkResult({ chunkId: Number(jobId), status: 'failed' })
        .pipe(
          Effect.catch((dbError) =>
            // The chunk row may be gone (the export was cancelled, which cascade-deletes chunks).
            // Nothing left to update — log and move on.
            Effect.logWarning({
              message: 'Failed to mark chunk failed (row may have been cancelled/deleted)',
              jobId,
              ...describeError(dbError),
            }),
          ),
        )
    })

  const runJob: ZipDownloader['Service']['runJob'] = (jobId) =>
    processJob(jobId).pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
          if (error instanceof ChunkStateNotFoundError) {
            yield* Effect.logError({
              message: 'Chunk row not found, cannot update export job',
              jobId: error.jobId,
            })
            return yield* Effect.die(error)
          }

          yield* handleJobFailure(jobId, error)
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
      ExportJobsRepositoryLayer,
      ZippedSubmissionsRepositoryLayer,
      S3ServiceLayer,
      EnsureParticipantZipLayer,
      UploadsConfigLayer,
    ),
  ),
)
