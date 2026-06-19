import { S3ClientError, S3Service, S3ServiceLayer } from '@blikka/aws'
import {
  DownloadStateRepository,
  type DownloadStateRepositoryError,
  DownloadStateRepositoryLayer,
} from '@blikka/kv-store'
import { Config, Context, Effect, Layer, Option } from 'effect'

export interface CleanupDownloadProcessResult {
  readonly deletedZipKeys: readonly string[]
  readonly deletedChunkStates: number
}

export class ZipDownloadCleanup extends Context.Service<
  ZipDownloadCleanup,
  {
    readonly cleanupDownloadProcessArtifacts: (
      processId: string,
    ) => Effect.Effect<
      CleanupDownloadProcessResult,
      DownloadStateRepositoryError | S3ClientError | Config.ConfigError,
      never
    >
    readonly rollbackFailedZipInitialization: (input: {
      domain: string
      processId: string
    }) => Effect.Effect<void, never, never>
  }
>()('@blikka/api/ZipDownloadCleanup') {}

const makeZipDownloadCleanup = Effect.gen(function* () {
  const downloadStateRepository = yield* DownloadStateRepository
  const s3Service = yield* S3Service
  const zipsBucket = yield* Config.string('ZIPS_BUCKET_NAME')

  const cleanupDownloadProcessArtifacts: ZipDownloadCleanup['Service']['cleanupDownloadProcessArtifacts'] =
    (processId) =>
      Effect.gen(function* () {
        const jobIds = yield* downloadStateRepository.getProcessJobIds(processId)
        const chunkStates = yield* Effect.forEach(jobIds, (jobId) =>
          downloadStateRepository.getChunkState(jobId),
        )

        const zipKeys = [
          ...new Set(
            chunkStates.filter(Option.isSome).map((chunkState) => chunkState.value.zipKey),
          ),
        ]

        yield* Effect.forEach(
          zipKeys,
          (zipKey) =>
            s3Service.deleteFile(zipsBucket, zipKey).pipe(
              Effect.tap(() =>
                Effect.logInfo({
                  message: 'Deleted partial marathon zip export object',
                  processId,
                  zipKey,
                }),
              ),
              Effect.catch((error) =>
                Effect.logWarning({
                  message: 'Failed to delete partial marathon zip export object',
                  processId,
                  zipKey,
                  error: error instanceof Error ? error.message : String(error),
                }),
              ),
            ),
          { concurrency: 5 },
        )

        const deletedChunkStates = yield* Effect.forEach(
          jobIds,
          (jobId) => downloadStateRepository.deleteChunkState(jobId),
          { concurrency: 'unbounded' },
        ).pipe(Effect.map((results) => results.reduce((sum, count) => sum + count, 0)))

        return {
          deletedZipKeys: zipKeys,
          deletedChunkStates,
        } satisfies CleanupDownloadProcessResult
      }).pipe(Effect.withSpan('ZipFiles.cleanupDownloadProcessArtifacts'))

  const rollbackFailedZipInitialization: ZipDownloadCleanup['Service']['rollbackFailedZipInitialization'] =
    ({ domain, processId }) =>
      Effect.gen(function* () {
        yield* cleanupDownloadProcessArtifacts(processId).pipe(
          Effect.catch((error) =>
            Effect.logWarning({
              message: 'Failed to clean up artifacts after zip initialization error',
              processId,
              domain,
              error: error instanceof Error ? error.message : String(error),
            }),
          ),
        )

        yield* downloadStateRepository.deleteDownloadProcess(processId).pipe(Effect.ignore)
        yield* downloadStateRepository.clearActiveProcessForDomain(domain).pipe(Effect.ignore)
        // Intentionally do NOT clear the `last` display pointer here: a failed *new* init must not
        // hide a previously-completed export. `last` is only replaced by the next successful init or
        // cleared by an explicit reset.
      }).pipe(Effect.withSpan('ZipFiles.rollbackFailedZipInitialization'))

  return ZipDownloadCleanup.of({
    cleanupDownloadProcessArtifacts,
    rollbackFailedZipInitialization,
  })
})

export const ZipDownloadCleanupLayerNoDeps = Layer.effect(
  ZipDownloadCleanup,
  makeZipDownloadCleanup,
)

export const ZipDownloadCleanupLayer = ZipDownloadCleanupLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DownloadStateRepositoryLayer, S3ServiceLayer)),
)
