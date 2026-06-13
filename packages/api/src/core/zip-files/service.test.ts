import { assert, describe, it } from '@effect/vitest'
import { S3Service } from '@blikka/aws'
import { DownloadStateRepository } from '@blikka/kv-store'
import { ParticipantsRepository, ZippedSubmissionsRepository } from '@blikka/db'
import { Cause, Effect, Exit, Layer, Option, Ref } from 'effect'

import { EnsureParticipantZip } from '@blikka/uploads/ensure-participant-zip'

import { ConflictError } from '../errors'
import { configLayerFromEnv } from '../test/config-layer'
import { ZipDownloadCleanup } from './cleanup-download-process'
import { ZipFilesService, ZipFilesServiceLayerNoDeps } from './service'
import { ZipDownloaderTrigger } from './trigger-zip-downloader-job'

const domain = 'demo'
const processId = 'process-1'

interface TestState {
  readonly stats: {
    totalParticipants: number
    withZippedSubmissions: number
    missingReferences: string[]
  }
  readonly processes: Record<string, Record<string, unknown>>
  readonly activeProcessByDomain: Record<string, string | undefined>
  readonly cancelledProcessIds: string[]
  readonly clearedDomains: string[]
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  stats: {
    totalParticipants: 10,
    withZippedSubmissions: 8,
    missingReferences: ['1009', '1010'],
  },
  processes: {},
  activeProcessByDomain: {},
  cancelledProcessIds: [],
  clearedDomains: [],
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

interface TestLayerOverrides {
  readonly zippedSubmissionsRepository?: ZippedSubmissionsRepository['Service']
  readonly downloadStateRepository?: DownloadStateRepository['Service']
}

const makeTestLayer = (stateRef: Ref.Ref<TestState>, overrides: TestLayerOverrides = {}) => {
  const zippedSubmissionsRepository =
    overrides.zippedSubmissionsRepository ??
    ZippedSubmissionsRepository.of({
    getZipSubmissionStatsByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.stats
      }),
    getCompletedParticipantsForZipPlanning: () => Effect.succeed([]),
  } as unknown as ZippedSubmissionsRepository['Service'])

  const downloadStateRepository =
    overrides.downloadStateRepository ??
    DownloadStateRepository.of({
    getDownloadProcess: (id: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.processes[id])
      }),
    getActiveProcessForDomain: (activeDomain: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.activeProcessByDomain[activeDomain])
      }),
    clearActiveProcessForDomain: (activeDomain: string) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        clearedDomains: [...state.clearedDomains, activeDomain],
      })).pipe(Effect.as(undefined)),
    cancelDownloadProcess: (id: string) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        cancelledProcessIds: [...state.cancelledProcessIds, id],
      })).pipe(Effect.as(undefined)),
    createDownloadProcess: () => Effect.void,
    updateDownloadProcess: () => Effect.void,
    setActiveProcessForDomain: () => Effect.void,
    saveChunkState: () => Effect.void,
    getChunkState: () => Effect.succeed(Option.none()),
    addJobToProcess: () => Effect.void,
    getProcessJobIds: () => Effect.succeed([]),
    deleteChunkState: () => Effect.succeed(1),
    deleteDownloadProcess: () => Effect.succeed(1),
  } as unknown as DownloadStateRepository['Service'])

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
          zippedSubmissions: [
            {
              id: 1,
              key: `${domain}/0042.zip`,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: null,
              marathonId: 1,
              participantId: 1,
            },
          ],
        }),
      ),
  } as unknown as ParticipantsRepository['Service'])

  const zipDownloadCleanup = ZipDownloadCleanup.of({
    cleanupDownloadProcessArtifacts: () =>
      Effect.succeed({ deletedZipKeys: [], deletedChunkStates: 0 }),
    rollbackFailedZipInitialization: () => Effect.void,
  })

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
        Layer.succeed(DownloadStateRepository)(downloadStateRepository),
        Layer.succeed(S3Service)(s3Service),
        Layer.succeed(ZipDownloadCleanup)(zipDownloadCleanup),
        Layer.succeed(ZipDownloaderTrigger)(zipDownloaderTrigger),
        Layer.succeed(EnsureParticipantZip)(ensureParticipantZip),
      ),
    ),
  )
}

const runWithState = <A, E>(
  stateRef: Ref.Ref<TestState>,
  effect: Effect.Effect<A, E, ZipFilesService>,
) =>
  Effect.gen(function* () {
    const result = yield* effect
    const state = yield* Ref.get(stateRef)
    return { result, state }
  }).pipe(
    Effect.provide(makeTestLayer(stateRef)),
    Effect.provide(configLayerFromEnv({ ZIPS_BUCKET_NAME: 'zips-bucket' })),
  )

describe('ZipFilesService', () => {
  it.effect('returns zip submission stats from the repository', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result } = yield* runWithState(
        stateRef,
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

  it.effect('rejects cancelling a process that belongs to another domain', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          processes: {
            [processId]: {
              processId,
              domain: 'other',
              status: 'processing',
              totalChunks: 1,
              completedChunks: 0,
              failedChunks: 0,
              failedJobIds: [],
              lastUpdatedAt: '2026-01-01T00:00:00.000Z',
              competitionClasses: [],
              jobIds: [],
            },
          },
        }),
      )

      const { result } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.cancelDownloadProcess({
            domain,
            processId,
          })
        }),
      )

      assert.equal(result.success, false)
      assert.match(result.message, /does not belong to this domain/)
    }),
  )

  it.effect('cancels an in-progress process and clears the active domain pointer', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          processes: {
            [processId]: {
              processId,
              domain,
              status: 'processing',
              totalChunks: 1,
              completedChunks: 0,
              failedChunks: 0,
              failedJobIds: [],
              lastUpdatedAt: '2026-01-01T00:00:00.000Z',
              competitionClasses: [],
              jobIds: [],
            },
          },
        }),
      )

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.cancelDownloadProcess({
            domain,
            processId,
          })
        }),
      )

      assert.equal(result.success, true)
      assert.deepEqual(state.cancelledProcessIds, [processId])
      assert.deepEqual(state.clearedDomains, [domain])
    }),
  )

  it.effect('clears stale active process pointers when process state is missing', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          activeProcessByDomain: {
            [domain]: processId,
          },
        }),
      )

      const { result, state } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.getActiveProcess({ domain })
        }),
      )

      assert.equal(result, null)
      assert.deepEqual(state.clearedDomains, [domain])
    }),
  )

  it.effect('returns presigned download urls for completed processes', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          processes: {
            [processId]: {
              processId,
              domain,
              status: 'completed',
              totalChunks: 1,
              completedChunks: 1,
              failedChunks: 0,
              failedJobIds: [],
              lastUpdatedAt: '2026-01-01T00:00:00.000Z',
              competitionClasses: [],
              jobIds: ['job-1'],
            },
          },
        }),
      )

      const downloadStateRepository = DownloadStateRepository.of({
        getDownloadProcess: (id: string) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return Option.fromNullishOr(state.processes[id])
          }),
        getChunkState: () =>
          Effect.succeed(
            Option.some({
              zipKey: `${domain}/zip-downloads/open/0001-0100.zip`,
              competitionClassName: 'open',
              minReference: 1,
              maxReference: 100,
            }),
          ),
        getActiveProcessForDomain: () => Effect.succeed(Option.none()),
        clearActiveProcessForDomain: () => Effect.void,
        cancelDownloadProcess: () => Effect.void,
        createDownloadProcess: () => Effect.void,
        updateDownloadProcess: () => Effect.void,
        setActiveProcessForDomain: () => Effect.void,
        saveChunkState: () => Effect.void,
        addJobToProcess: () => Effect.void,
      } as unknown as DownloadStateRepository['Service'])

      const layer = makeTestLayer(stateRef, { downloadStateRepository })

      const result = yield* Effect.gen(function* () {
        const service = yield* ZipFilesService
        return yield* service.getZipDownloadUrls({ processId })
      }).pipe(
        Effect.provide(layer),
        Effect.provide(configLayerFromEnv({ ZIPS_BUCKET_NAME: 'zips-bucket' })),
      )

      assert.isDefined(result)
      assert.equal(result?.[0]?.downloadUrl, `https://example.com/${domain}/zip-downloads/open/0001-0100.zip`)
    }),
  )

  it.effect('returns a presigned download url for a participant zip', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(makeInitialState())

      const { result } = yield* runWithState(
        stateRef,
        Effect.gen(function* () {
          const service = yield* ZipFilesService
          return yield* service.getParticipantZipDownloadUrl({ domain, reference: '0042' })
        }),
      )

      assert.equal(result.downloadUrl, `https://example.com/${domain}/0042.zip`)
      assert.equal(result.filename, '0042.zip')
    }),
  )

  it.effect('rejects initialize when a zip export is already in progress', () =>
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(
        makeInitialState({
          activeProcessByDomain: {
            [domain]: processId,
          },
          processes: {
            [processId]: {
              processId,
              domain,
              status: 'processing',
              totalChunks: 2,
              completedChunks: 0,
              failedChunks: 0,
              failedJobIds: [],
              lastUpdatedAt: '2026-01-01T00:00:00.000Z',
              competitionClasses: [],
              jobIds: [],
            },
          },
        }),
      )

      const zippedSubmissionsRepository = ZippedSubmissionsRepository.of({
        getZipSubmissionStatsByDomain: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return state.stats
          }),
        getCompletedParticipantsForZipPlanning: () =>
          Effect.succeed([
            {
              reference: '1',
              competitionClass: { id: 1, name: 'Open' },
            },
          ]),
      } as unknown as ZippedSubmissionsRepository['Service'])

      const layer = makeTestLayer(stateRef, { zippedSubmissionsRepository })

      const exit = yield* Effect.gen(function* () {
        const service = yield* ZipFilesService
        return yield* service.initializeZipDownloads({ domain })
      }).pipe(
        Effect.provide(layer),
        Effect.provide(configLayerFromEnv({ ZIPS_BUCKET_NAME: 'zips-bucket' })),
        Effect.exit,
      )

      assert.isTrue(Exit.isFailure(exit))
      const error = Cause.squash(exit.cause)
      assert.instanceOf(error, ConflictError)
    }),
  )
})
