import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import { DownloadStateRepository } from '@blikka/kv-store'
import { Effect, Layer, Option } from 'effect'

import { configLayerFromEnv } from '../test/config-layer'
import { ZipDownloadCleanup, ZipDownloadCleanupLayerNoDeps } from './cleanup-download-process'

describe('ZipDownloadCleanup', () => {
  it.effect('deletes known zip keys and chunk state for a process', () =>
    Effect.gen(function* () {
      const zipKey = 'demo/zip-downloads/open/0001-0100.zip'
      const deletedKeys: string[] = []

      const downloadStateRepository = DownloadStateRepository.of({
        getProcessJobIds: () => Effect.succeed(['job-1']),
        getChunkState: (jobId: string) =>
          jobId === 'job-1'
            ? Effect.succeed(
                Option.some({
                  processId: 'process-1',
                  domain: 'demo',
                  competitionClassId: 1,
                  competitionClassName: 'open',
                  minReference: 1,
                  maxReference: 100,
                  zipKey,
                  chunkIndex: 0,
                  classTotalChunks: 1,
                  processTotalChunks: 1,
                }),
              )
            : Effect.succeed(Option.none()),
        deleteChunkState: () => Effect.succeed(1),
      } as unknown as DownloadStateRepository['Service'])

      const layer = ZipDownloadCleanupLayerNoDeps.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(DownloadStateRepository)(downloadStateRepository),
            Layer.succeed(S3Service)(
              S3Service.of({
                deleteFile: (_bucket: string, key: string) => {
                  deletedKeys.push(key)
                  return Effect.succeed({} as never)
                },
              } as unknown as S3Service['Service']),
            ),
            configLayerFromEnv({ ZIPS_BUCKET_NAME: 'zips-bucket' }),
          ),
        ),
      )

      const result = yield* Effect.gen(function* () {
        const cleanup = yield* ZipDownloadCleanup
        return yield* cleanup.cleanupDownloadProcessArtifacts('process-1')
      }).pipe(Effect.provide(layer))

      assert.deepEqual(result.deletedZipKeys, [zipKey])
      assert.equal(result.deletedChunkStates, 1)
      assert.deepEqual(deletedKeys, [zipKey])
    }),
  )
})
