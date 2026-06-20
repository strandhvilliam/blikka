import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import {
  ExportJobsRepository,
  MarathonsRepository,
  ParticipantsRepository,
  ZippedSubmissionsRepository,
} from '@blikka/db'
import { Cause, Effect, Exit, Layer, Option } from 'effect'

import { EnsureParticipantZip } from '@blikka/uploads/ensure-participant-zip'

import { ConflictError } from '../errors'
import { configLayerFromEnv } from '../test/config-layer'
import { ZipFilesService, ZipFilesServiceLayerNoDeps } from './service'
import { ZipDownloaderTrigger } from './trigger-zip-downloader-job'

const domain = 'demo'
const marathonId = 1

interface TestLayerOverrides {
  readonly zippedSubmissionsRepository?: ZippedSubmissionsRepository['Service']
  readonly exportJobsRepository?: ExportJobsRepository['Service']
}

const baseExportJobsRepository = ExportJobsRepository.of({
  createJobWithChunks: () => Effect.die('not implemented'),
  getLatestJobForMarathon: () => Effect.succeed(Option.none()),
  findProcessingJob: () => Effect.succeed(Option.none()),
  getJobChunks: () => Effect.succeed([]),
  getChunk: () => Effect.succeed(Option.none()),
  getChunkWithDomain: () => Effect.succeed(Option.none()),
  setChunkStatus: () => Effect.die('not implemented'),
  applyChunkResult: () => Effect.succeed(Option.none()),
  reactivateChunkForRetry: () => Effect.succeed(Option.none()),
  deleteJob: () => Effect.void,
} as unknown as ExportJobsRepository['Service'])

const makeTestLayer = (overrides: TestLayerOverrides = {}) => {
  const zippedSubmissionsRepository =
    overrides.zippedSubmissionsRepository ??
    ZippedSubmissionsRepository.of({
      getZipSubmissionStatsByDomain: () =>
        Effect.succeed({
          totalParticipants: 10,
          withZippedSubmissions: 8,
          missingReferences: ['1009', '1010'],
        }),
      getCompletedParticipantsForZipPlanning: () => Effect.succeed([]),
      getParticipantReferencesInRange: () => Effect.succeed([]),
    } as unknown as ZippedSubmissionsRepository['Service'])

  const exportJobsRepository = overrides.exportJobsRepository ?? baseExportJobsRepository

  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomain: () => Effect.succeed(Option.some({ id: marathonId, domain })),
  } as unknown as MarathonsRepository['Service'])

  const s3Service = S3Service.of({
    getPresignedUrl: (_bucket: string, key: string) => Effect.succeed(`https://example.com/${key}`),
    deleteFile: () => Effect.succeed({} as never),
  } as unknown as S3Service['Service'])

  const participantsRepository = ParticipantsRepository.of({
    getParticipantByReference: () =>
      Effect.succeed(
        Option.some({
          id: 1,
          reference: '0042',
          domain,
          submissions: [{ id: 1 }],
        }),
      ),
  } as unknown as ParticipantsRepository['Service'])

  const zipDownloaderTrigger = ZipDownloaderTrigger.of({
    triggerJob: () => Effect.void,
  })

  const ensureParticipantZip = EnsureParticipantZip.of({
    ensureParticipantZip: ({ domain: d, reference }: { domain: string; reference: string }) =>
      Effect.succeed({ key: `${d}/${reference}.zip`, generated: true }),
  } as unknown as EnsureParticipantZip['Service'])

  return ZipFilesServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ZippedSubmissionsRepository)(zippedSubmissionsRepository),
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(ExportJobsRepository)(exportJobsRepository),
        Layer.succeed(S3Service)(s3Service),
        Layer.succeed(ZipDownloaderTrigger)(zipDownloaderTrigger),
        Layer.succeed(EnsureParticipantZip)(ensureParticipantZip),
      ),
    ),
  )
}

const run = <A, E>(effect: Effect.Effect<A, E, ZipFilesService>, overrides?: TestLayerOverrides) =>
  effect.pipe(
    Effect.provide(makeTestLayer(overrides)),
    Effect.provide(configLayerFromEnv({ ZIPS_BUCKET_NAME: 'zips-bucket' })),
  )

describe('ZipFilesService', () => {
  it.effect('returns zip submission stats from the repository', () =>
    Effect.gen(function* () {
      const result = yield* run(
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.getZipSubmissionStats({ domain })
        }),
      )

      assert.equal(result.totalParticipants, 10)
      assert.equal(result.withZippedSubmissions, 8)
      assert.deepEqual(result.missingReferences, ['1009', '1010'])
    }),
  )

  it.effect('returns a presigned download url for a participant zip', () =>
    Effect.gen(function* () {
      const result = yield* run(
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.getParticipantZipDownloadUrl({ domain, reference: '0042' })
        }),
      )

      assert.equal(result.downloadUrl, `https://example.com/${domain}/0042.zip`)
      assert.equal(result.filename, '0042.zip')
    }),
  )

  it.effect('returns null export files when the marathon has never run an export', () =>
    Effect.gen(function* () {
      const result = yield* run(
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.getExportFiles({ domain })
        }),
      )

      assert.equal(result, null)
    }),
  )

  it.effect('builds the export files view with presigned urls for ready chunks', () =>
    Effect.gen(function* () {
      const exportJobsRepository = {
        ...baseExportJobsRepository,
        getLatestJobForMarathon: () =>
          Effect.succeed(
            Option.some({
              id: 7,
              marathonId,
              status: 'completed',
              totalChunks: 1,
              completedChunks: 1,
              failedChunks: 0,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            }),
          ),
        getJobChunks: () =>
          Effect.succeed([
            {
              id: 11,
              exportJobId: 7,
              competitionClassId: 1,
              competitionClassName: 'open',
              minReference: 1,
              maxReference: 100,
              zipKey: `${domain}/zip-downloads/open/0001-0100.zip`,
              status: 'ready',
              chunkIndex: 0,
              classTotalChunks: 1,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: null,
            },
          ]),
      } as unknown as ExportJobsRepository['Service']

      const result = yield* run(
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.getExportFiles({ domain })
        }),
        { exportJobsRepository },
      )

      assert.isNotNull(result)
      assert.equal(result?.exportJobId, '7')
      assert.equal(result?.status, 'completed')
      assert.equal(result?.files.length, 1)
      assert.equal(result?.files[0]?.jobId, '11')
      assert.equal(result?.files[0]?.status, 'ready')
      assert.equal(
        result?.files[0]?.downloadUrl,
        `https://example.com/${domain}/zip-downloads/open/0001-0100.zip`,
      )
    }),
  )

  it.effect('rejects initialize when a zip export is already in progress', () =>
    Effect.gen(function* () {
      const zippedSubmissionsRepository = ZippedSubmissionsRepository.of({
        getZipSubmissionStatsByDomain: () =>
          Effect.succeed({
            totalParticipants: 1,
            withZippedSubmissions: 1,
            missingReferences: [],
          }),
        getCompletedParticipantsForZipPlanning: () =>
          Effect.succeed([{ reference: '1', competitionClass: { id: 1, name: 'Open' } }]),
        getParticipantReferencesInRange: () => Effect.succeed([]),
      } as unknown as ZippedSubmissionsRepository['Service'])

      const exportJobsRepository = {
        ...baseExportJobsRepository,
        findProcessingJob: () =>
          Effect.succeed(
            Option.some({
              id: 3,
              marathonId,
              status: 'processing',
              totalChunks: 2,
              completedChunks: 0,
              failedChunks: 0,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: null,
            }),
          ),
      } as unknown as ExportJobsRepository['Service']

      const exit = yield* run(
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.initializeZipDownloads({ domain })
        }),
        { zippedSubmissionsRepository, exportJobsRepository },
      ).pipe(Effect.exit)

      if (Exit.isFailure(exit)) {
        const error = Cause.squash(exit.cause)
        assert.instanceOf(error, ConflictError)
      } else {
        assert.fail('expected initializeZipDownloads to fail with ConflictError')
      }
    }),
  )

  it.effect('refuses to cancel a completed export', () =>
    Effect.gen(function* () {
      const exportJobsRepository = {
        ...baseExportJobsRepository,
        getLatestJobForMarathon: () =>
          Effect.succeed(
            Option.some({
              id: 5,
              marathonId,
              status: 'completed',
              totalChunks: 1,
              completedChunks: 1,
              failedChunks: 0,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: null,
            }),
          ),
      } as unknown as ExportJobsRepository['Service']

      const result = yield* run(
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.cancelDownloadProcess({ domain, exportJobId: '5' })
        }),
        { exportJobsRepository },
      )

      assert.equal(result.success, false)
      assert.match(result.message, /Completed exports cannot be reset/)
    }),
  )
})
