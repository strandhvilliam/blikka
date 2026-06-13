
import { S3Service, S3ServiceLayer, S3ClientError } from '@blikka/aws'
import { DbLayer, ParticipantsRepository, ZippedSubmissionsRepository, DbError } from '@blikka/db'
import {
  DownloadStateRepository,
  DownloadStateRepositoryLayer,
  type DownloadProcessState,
  type DownloadProcessStatus,
  type DownloadStateRepositoryError,
} from '@blikka/kv-store'
import {
  EnsureParticipantZip,
  EnsureParticipantZipLayer,
  type ZipWorkerError,
} from '@blikka/uploads/ensure-participant-zip'
import { Effect, Option, Config, Context, Layer } from 'effect'

import { BadRequestError, ConflictError, NotFoundError, failNotFoundIfNone } from '../errors'
import { ZipDownloadCleanup, ZipDownloadCleanupLayer } from './cleanup-download-process'
import type {
  CancelDownloadProcessInput,
  GenerateParticipantZipInput,
  GetActiveProcessInput,
  GetParticipantZipDownloadUrlInput,
  GetZipSubmissionStatusInput,
  InitializeZipDownloadsInput,
  RetryExportChunkInput,
  ZipDownloadsByProcessIdInput,
} from './contracts'
import { planZipDownload } from './zip-download-plan'
import {
  UnableToRunZipDownloaderTaskError,
  ZipDownloaderTrigger,
  ZipDownloaderTriggerLayer,
} from './trigger-zip-downloader-job'

const RESETTABLE_DOWNLOAD_PROCESS_STATUSES = new Set<DownloadProcessStatus>([
  'initializing',
  'processing',
  'failed',
  'cancelled',
])

// Each chunk runs in one ECS task that, on a cold cache, both generates the missing
// per-participant zips (downloading originals) AND merges them. Keep this modest so peak
// memory/time per task stays bounded. See docs/upload-pipeline-scaling.md.
const MAX_PARTICIPANTS_PER_ZIP = 100

interface ZipSubmissionStats {
  totalParticipants: number
  withZippedSubmissions: number
  missingReferences: string[]
}

type ZipDownloadProgressView = Pick<
  DownloadProcessState,
  | 'processId'
  | 'status'
  | 'totalChunks'
  | 'completedChunks'
  | 'failedChunks'
  | 'failedJobIds'
  | 'lastUpdatedAt'
  | 'competitionClasses'
>

function toZipDownloadProgressView(state: DownloadProcessState): ZipDownloadProgressView {
  return {
    processId: state.processId,
    status: state.status,
    totalChunks: state.totalChunks,
    completedChunks: state.completedChunks,
    failedChunks: state.failedChunks,
    failedJobIds: state.failedJobIds,
    lastUpdatedAt: state.lastUpdatedAt,
    competitionClasses: state.competitionClasses,
  }
}

interface ZipDownloadUrlItem {
  competitionClassName: string
  minReference: number
  maxReference: number
  zipKey: string
  downloadUrl: string
}

export type ExportFileStatus = 'building' | 'ready' | 'failed'

/** One downloadable archive (= one chunk), with its live build status and a URL once ready. */
export interface ExportFileRow {
  jobId: string
  competitionClassName: string
  minReference: number
  maxReference: number
  status: ExportFileStatus
  downloadUrl?: string
}

/** Live view of the active export's files — the single source for the file-list UI. */
export interface ExportFilesView {
  processId: string
  status: DownloadProcessStatus
  totalChunks: number
  completedChunks: number
  failedChunks: number
  lastUpdatedAt: string
  files: ExportFileRow[]
}

interface ExportClassPreview {
  competitionClassName: string
  participantCount: number
  fileCount: number
}

/** Pre-flight summary shown before an export is started (status-based, not zip-row based). */
export interface ExportPreview {
  completedParticipants: number
  totalFiles: number
  classes: ExportClassPreview[]
}

type InitializeZipDownloadsResult =
  | {
      message: string
      domain: string
      totalChunks: number
      totalCompetitionClasses: number
      processId?: undefined
    }
  | {
      message: string
      processId: string
      domain: string
      totalCompetitionClasses: number
      totalChunks: number
    }

type InitializeZipDownloadsError =
  | DbError
  | DownloadStateRepositoryError
  | Config.ConfigError
  | UnableToRunZipDownloaderTaskError
  | BadRequestError
  | ConflictError

export class ZipFilesService extends Context.Service<
  ZipFilesService,
  {
    /** Counts participants vs zipped rows and lists references still missing zips. */
    readonly getZipSubmissionStats: (
      input: GetZipSubmissionStatusInput,
    ) => Effect.Effect<ZipSubmissionStats, DbError, never>

    /** After completion, returns presigned GET URLs for each finished chunk ZIP. */
    readonly getZipDownloadUrls: (
      input: ZipDownloadsByProcessIdInput,
    ) => Effect.Effect<
      ZipDownloadUrlItem[] | null,
      S3ClientError | Config.ConfigError | DownloadStateRepositoryError,
      never
    >

    /**
     * Plans chunk jobs per competition class, persists process state, and triggers ECS zip-downloader tasks.
     */
    readonly initializeZipDownloads: (
      input: InitializeZipDownloadsInput,
    ) => Effect.Effect<InitializeZipDownloadsResult, InitializeZipDownloadsError, never>

    /** Returns the in-flight download process for `domain` if any, or null. */
    readonly getActiveProcess: (
      input: GetActiveProcessInput,
    ) => Effect.Effect<ZipDownloadProgressView | null, DownloadStateRepositoryError, never>

    /**
     * Stops a download process, removes partial zip objects from S3, and clears Redis state
     * so a new export can be started.
     */
    readonly cancelDownloadProcess: (
      input: CancelDownloadProcessInput,
    ) => Effect.Effect<
      { success: boolean; message: string; deletedZipKeys?: readonly string[] },
      DownloadStateRepositoryError | S3ClientError | Config.ConfigError,
      never
    >

    /** Builds and stores a participant zip from their current submissions. */
    readonly generateParticipantZip: (
      input: GenerateParticipantZipInput,
    ) => Effect.Effect<
      { success: boolean; key: string },
      DbError | BadRequestError | NotFoundError | ZipWorkerError,
      never
    >

    /** Returns a presigned GET URL for a participant's zip, generating it on demand if needed. */
    readonly getParticipantZipDownloadUrl: (
      input: GetParticipantZipDownloadUrlInput,
    ) => Effect.Effect<
      { downloadUrl: string; filename: string },
      DbError | BadRequestError | NotFoundError | S3ClientError | Config.ConfigError | ZipWorkerError,
      never
    >

    /**
     * Live per-file view of the active export: each chunk's class, reference range, build status,
     * and a presigned URL as soon as it is ready (download-as-ready). Null when no active process.
     */
    readonly getExportFiles: (
      input: GetActiveProcessInput,
    ) => Effect.Effect<ExportFilesView | null, DownloadStateRepositoryError | S3ClientError, never>

    /** Re-queue a single failed chunk: reactivate the process and re-trigger its ECS job. */
    readonly retryExportChunk: (
      input: RetryExportChunkInput,
    ) => Effect.Effect<
      { success: boolean },
      | DownloadStateRepositoryError
      | BadRequestError
      | UnableToRunZipDownloaderTaskError
      | Config.ConfigError,
      never
    >

    /** Status-based pre-flight: how many completed participants and archive files an export yields. */
    readonly getExportPreview: (
      input: GetZipSubmissionStatusInput,
    ) => Effect.Effect<ExportPreview, DbError, never>
  }
>()('@blikka/api/ZipFilesService') {}

const makeZipFilesService = Effect.gen(function* () {
  const zippedSubmissionsRepository = yield* ZippedSubmissionsRepository
  const participantsRepository = yield* ParticipantsRepository
  const downloadStateRepository = yield* DownloadStateRepository
  const s3Service = yield* S3Service
  const ensureParticipantZip = yield* EnsureParticipantZip
  const zipDownloadCleanup = yield* ZipDownloadCleanup
  const zipDownloaderTrigger = yield* ZipDownloaderTrigger
  const zipsBucket = yield* Config.string('ZIPS_BUCKET_NAME')

  const getZipSubmissionStats: ZipFilesService['Service']['getZipSubmissionStats'] = Effect.fn(
    'ZipFilesService.getZipSubmissionStats',
  )(function* ({ domain }) {
    const stats = yield* zippedSubmissionsRepository.getZipSubmissionStatsByDomain({
      domain,
    })
    return stats
  })

  const getActiveProcess: ZipFilesService['Service']['getActiveProcess'] = Effect.fn(
    'ZipFilesService.getActiveProcess',
  )(function* ({ domain }) {
    const processIdOption = yield* downloadStateRepository.getActiveProcessForDomain(domain)

    if (Option.isNone(processIdOption)) {
      return null
    }

    const processId = processIdOption.value
    const processStateOption = yield* downloadStateRepository.getDownloadProcess(processId)

    if (Option.isNone(processStateOption)) {
      yield* downloadStateRepository.clearActiveProcessForDomain(domain)
      return null
    }

    return toZipDownloadProgressView(processStateOption.value)
  })

  const cancelDownloadProcess: ZipFilesService['Service']['cancelDownloadProcess'] = Effect.fn(
    'ZipFilesService.cancelDownloadProcess',
  )(function* ({ domain, processId }) {
    const processStateOption = yield* downloadStateRepository.getDownloadProcess(processId)

    if (Option.isNone(processStateOption)) {
      yield* downloadStateRepository.clearActiveProcessForDomain(domain)
      return { success: true, message: 'Export already cleared' }
    }

    const state = processStateOption.value
    if (state.domain !== domain) {
      return {
        success: false,
        message: 'Process does not belong to this domain',
      }
    }

    if (state.status === 'completed') {
      return {
        success: false,
        message: 'Completed exports cannot be reset. Start a new export instead.',
      }
    }

    if (!RESETTABLE_DOWNLOAD_PROCESS_STATUSES.has(state.status)) {
      return {
        success: false,
        message: `Process cannot be reset while ${state.status}`,
      }
    }

    const cleanup = yield* zipDownloadCleanup.cleanupDownloadProcessArtifacts(processId)

    if (state.status !== 'cancelled') {
      yield* downloadStateRepository.cancelDownloadProcess(processId)
    }

    yield* downloadStateRepository.deleteDownloadProcess(processId)
    yield* downloadStateRepository.clearActiveProcessForDomain(domain)

    yield* Effect.logInfo({
      message: 'Download process reset',
      processId,
      domain,
      deletedZipKeys: cleanup.deletedZipKeys.length,
      deletedChunkStates: cleanup.deletedChunkStates,
    })

    const deletedCount = cleanup.deletedZipKeys.length
    return {
      success: true,
      message:
        deletedCount > 0
          ? `Export reset and ${deletedCount} partial ${deletedCount === 1 ? 'file' : 'files'} removed.`
          : 'Export reset. You can start a new export.',
      deletedZipKeys: cleanup.deletedZipKeys,
    }
  })

  const getZipDownloadUrls: ZipFilesService['Service']['getZipDownloadUrls'] = Effect.fn(
    'ZipFilesService.getZipDownloadUrls',
  )(function* ({ processId }) {
    const processStateOption = yield* downloadStateRepository.getDownloadProcess(processId)
    if (Option.isNone(processStateOption)) {
      return null
    }
    const processState = processStateOption.value
    if (processState.status !== 'completed') {
      return null
    }

    const jobIds = processState.jobIds

    if (jobIds.length === 0) {
      return []
    }

    const chunkStates = yield* Effect.forEach(jobIds, (jobId) =>
      downloadStateRepository.getChunkState(jobId),
    )

    const validChunks = chunkStates.filter((cs) => Option.isSome(cs)).map((cs) => cs.value)

    const urls = yield* Effect.forEach(validChunks, (chunkState) =>
      Effect.map(
        s3Service.getPresignedUrl(zipsBucket, chunkState.zipKey, 'GET', {
          expiresIn: 86400,
        }),
        (url) => ({
          competitionClassName: chunkState.competitionClassName,
          minReference: chunkState.minReference,
          maxReference: chunkState.maxReference,
          zipKey: chunkState.zipKey,
          downloadUrl: url,
        }),
      ),
    )

    return urls
  })

  const initializeZipDownloads: ZipFilesService['Service']['initializeZipDownloads'] = Effect.fn(
    'ZipFilesService.initializeZipDownloads',
  )(function* ({ domain }) {
    // Source the participant set from the participants table, not zipped_submissions: zips are
    // now generated lazily at download time, so no zip rows exist until the downloader runs.
    const completedParticipants =
      yield* zippedSubmissionsRepository.getCompletedParticipantsForZipPlanning({ domain })

    if (completedParticipants.length === 0) {
      yield* Effect.logInfo({
        message: 'No completed participants found for domain',
        domain,
      })
      return {
        message: 'No completed participants found for domain',
        domain,
        totalChunks: 0,
        totalCompetitionClasses: 0,
      }
    }

    const participantsWithCompetitionClass = completedParticipants.filter(
      (participant) => !!participant.competitionClass,
    )

    if (participantsWithCompetitionClass.length === 0) {
      yield* Effect.logInfo({
        message: 'No completed participants with competition class found',
        domain,
      })
      return {
        message: 'No completed participants with competition class found',
        domain,
        totalChunks: 0,
        totalCompetitionClasses: 0,
      }
    }

    const plan = planZipDownload(
      domain,
      participantsWithCompetitionClass.map((participant) => ({
        participant: {
          reference: participant.reference,
          competitionClass: participant.competitionClass!,
        },
      })),
      MAX_PARTICIPANTS_PER_ZIP,
    )

    const activeProcessIdOption = yield* downloadStateRepository.getActiveProcessForDomain(domain)

    if (Option.isSome(activeProcessIdOption)) {
      const activeProcessOption = yield* downloadStateRepository.getDownloadProcess(
        activeProcessIdOption.value,
      )

      if (Option.isSome(activeProcessOption)) {
        const activeStatus = activeProcessOption.value.status

        if (activeStatus === 'initializing' || activeStatus === 'processing') {
          return yield* Effect.fail(
            new ConflictError({
              message: 'A zip export is already in progress for this marathon.',
              cause: { processId: activeProcessOption.value.processId },
            }),
          )
        }
      }

      yield* downloadStateRepository.clearActiveProcessForDomain(domain)
    }

    const processId = crypto.randomUUID()

    const initializationResult = yield* Effect.gen(function* () {
      yield* downloadStateRepository.createDownloadProcess(
        processId,
        domain,
        plan.totalChunksAcrossAllClasses,
      )

      yield* downloadStateRepository.updateDownloadProcess(processId, {
        competitionClasses: [...plan.competitionClasses],
        status: 'processing',
      })

      yield* downloadStateRepository.setActiveProcessForDomain(domain, processId)

      yield* Effect.logInfo({
        message: 'Download process created',
        processId,
        domain,
        totalChunks: plan.totalChunksAcrossAllClasses,
        competitionClassesCount: plan.competitionClasses.length,
      })

      yield* Effect.forEach(
        plan.chunkJobs,
        (chunkJob) =>
          Effect.gen(function* () {
            const jobId = crypto.randomUUID()

            yield* downloadStateRepository
              .saveChunkState(jobId, {
                processId,
                domain,
                competitionClassId: chunkJob.competitionClassId,
                competitionClassName: chunkJob.competitionClassName,
                minReference: Number(chunkJob.minParticipantReference),
                maxReference: Number(chunkJob.maxParticipantReference),
                zipKey: chunkJob.zipKey,
                chunkIndex: chunkJob.chunkIndex,
                classTotalChunks: chunkJob.classTotalChunks,
                processTotalChunks: plan.totalChunksAcrossAllClasses,
              })
              .pipe(
                Effect.tapError((error) =>
                  Effect.logError({
                    message: 'Failed to save chunk state to Redis',
                    jobId,
                    processId,
                    error: error instanceof Error ? error.message : String(error),
                  }),
                ),
              )

            const savedStateOption = yield* downloadStateRepository.getChunkState(jobId).pipe(
              Effect.tapError((error) =>
                Effect.logError({
                  message: 'Failed to retrieve chunk state from Redis for verification',
                  jobId,
                  processId,
                  error: error instanceof Error ? error.message : String(error),
                }),
              ),
            )

            if (Option.isNone(savedStateOption)) {
              yield* Effect.logError({
                message: 'Failed to verify chunk state was saved to Redis - state not found',
                jobId,
                processId,
              })
              return yield* Effect.fail(
                new BadRequestError({
                  message: `Failed to save chunk state for jobId: ${jobId}`,
                }),
              )
            }

            yield* downloadStateRepository.addJobToProcess(processId, jobId)

            yield* Effect.logInfo({
              message: 'Chunk state saved to Redis and added to process',
              processId,
              jobId,
              domain,
              competitionClassId: chunkJob.competitionClassId,
              competitionClassName: chunkJob.competitionClassName,
              minReference: chunkJob.minParticipantReference,
              maxReference: chunkJob.maxParticipantReference,
              zipKey: chunkJob.zipKey,
              chunkIndex: chunkJob.chunkIndex,
              totalChunks: chunkJob.classTotalChunks,
            })

            yield* zipDownloaderTrigger.triggerJob(jobId)
          }),
        { concurrency: 'unbounded' },
      ).pipe(
        Effect.tapError((error) =>
          Effect.logError({
            message: 'Error processing chunks',
            error: error instanceof Error ? error.message : String(error),
          }),
        ),
      )

      return {
        message: 'Zip download jobs initialized',
        processId,
        domain,
        totalCompetitionClasses: plan.competitionClasses.length,
        totalChunks: plan.totalChunksAcrossAllClasses,
      }
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* zipDownloadCleanup.rollbackFailedZipInitialization({ domain, processId })
          return yield* Effect.fail(error)
        }),
      ),
    )

    return initializationResult
  })

  const getParticipantZipDownloadUrl: ZipFilesService['Service']['getParticipantZipDownloadUrl'] =
    Effect.fn('ZipFilesService.getParticipantZipDownloadUrl')(function* ({ domain, reference }) {
      const participant = yield* participantsRepository
        .getParticipantByReference({ reference, domain })
        .pipe(failNotFoundIfNone('Participant', { reference, domain }))

      if (participant.submissions.length === 0) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'Participant has no submissions to zip',
          }),
        )
      }

      // Generate the participant zip on demand (reuses the cached zip if it already exists).
      const { key } = yield* ensureParticipantZip.ensureParticipantZip({ domain, reference })

      const downloadUrl = yield* s3Service.getPresignedUrl(zipsBucket, key, 'GET', {
        expiresIn: 3600,
      })

      return {
        downloadUrl,
        filename: `${reference}.zip`,
      }
    })

  const generateParticipantZip: ZipFilesService['Service']['generateParticipantZip'] = Effect.fn(
    'ZipFilesService.generateParticipantZip',
  )(function* ({ domain, reference }) {
    const participant = yield* participantsRepository
      .getParticipantByReference({ reference, domain })
      .pipe(failNotFoundIfNone('Participant', { reference, domain }))

    if (participant.submissions.length === 0) {
      return yield* Effect.fail(
        new BadRequestError({
          message: 'Participant has no submissions to zip',
        }),
      )
    }

    const { key } = yield* ensureParticipantZip.ensureParticipantZip({ domain, reference })

    return {
      success: true,
      key,
    }
  })

  const getExportFiles: ZipFilesService['Service']['getExportFiles'] = Effect.fn(
    'ZipFilesService.getExportFiles',
  )(function* ({ domain }) {
    const activeProcessIdOption = yield* downloadStateRepository.getActiveProcessForDomain(domain)
    if (Option.isNone(activeProcessIdOption)) {
      return null
    }
    const processId = activeProcessIdOption.value

    const summaryOption = yield* downloadStateRepository.getProcessSummary(processId)
    if (Option.isNone(summaryOption)) {
      yield* downloadStateRepository.clearActiveProcessForDomain(domain)
      return null
    }
    const summary = summaryOption.value

    const [jobIds, completedJobIds, failedJobIds] = yield* Effect.all(
      [
        downloadStateRepository.getProcessJobIds(processId),
        downloadStateRepository.getCompletedJobIds(processId),
        downloadStateRepository.getFailedJobIds(processId),
      ],
      { concurrency: 3 },
    )
    const completedSet = new Set(completedJobIds)
    const failedSet = new Set(failedJobIds)

    const chunkRows = yield* Effect.forEach(
      jobIds,
      (jobId) =>
        downloadStateRepository.getChunkState(jobId).pipe(Effect.map((state) => ({ jobId, state }))),
      { concurrency: 10 },
    )
    const presentRows = chunkRows.flatMap(({ jobId, state }) =>
      Option.isSome(state) ? [{ jobId, chunk: state.value }] : [],
    )

    const files = yield* Effect.forEach(
      presentRows,
      ({ jobId, chunk }) => {
        const status: ExportFileStatus = failedSet.has(jobId)
          ? 'failed'
          : completedSet.has(jobId)
            ? 'ready'
            : 'building'

        const base: ExportFileRow = {
          jobId,
          competitionClassName: chunk.competitionClassName,
          minReference: chunk.minReference,
          maxReference: chunk.maxReference,
          status,
        }

        if (status === 'ready') {
          return s3Service
            .getPresignedUrl(zipsBucket, chunk.zipKey, 'GET', { expiresIn: 86400 })
            .pipe(Effect.map((downloadUrl): ExportFileRow => ({ ...base, downloadUrl })))
        }
        return Effect.succeed(base)
      },
      { concurrency: 10 },
    )

    files.sort(
      (a, b) =>
        a.competitionClassName.localeCompare(b.competitionClassName) ||
        a.minReference - b.minReference,
    )

    return {
      processId,
      status: summary.status,
      totalChunks: summary.totalChunks,
      completedChunks: summary.completedChunks,
      failedChunks: summary.failedChunks,
      lastUpdatedAt: summary.lastUpdatedAt,
      files,
    }
  })

  const retryExportChunk: ZipFilesService['Service']['retryExportChunk'] = Effect.fn(
    'ZipFilesService.retryExportChunk',
  )(function* ({ domain, processId, jobId }) {
    const chunkStateOption = yield* downloadStateRepository.getChunkState(jobId)
    if (Option.isNone(chunkStateOption)) {
      return yield* Effect.fail(
        new BadRequestError({ message: 'This file is no longer available to retry.' }),
      )
    }
    const chunk = chunkStateOption.value
    if (chunk.processId !== processId || chunk.domain !== domain) {
      return yield* Effect.fail(
        new BadRequestError({ message: 'This file does not belong to the current export.' }),
      )
    }

    const failedJobIds = yield* downloadStateRepository.getFailedJobIds(processId)
    if (!failedJobIds.includes(jobId)) {
      return yield* Effect.fail(
        new BadRequestError({ message: 'Only failed files can be retried.' }),
      )
    }

    yield* downloadStateRepository.reactivateChunkForRetry(processId, jobId)
    // Re-point the domain at this process in case the active pointer was cleared, then re-run the job.
    yield* downloadStateRepository.setActiveProcessForDomain(domain, processId)
    yield* zipDownloaderTrigger.triggerJob(jobId)

    return { success: true }
  })

  const getExportPreview: ZipFilesService['Service']['getExportPreview'] = Effect.fn(
    'ZipFilesService.getExportPreview',
  )(function* ({ domain }) {
    const participants = yield* zippedSubmissionsRepository.getCompletedParticipantsForZipPlanning({
      domain,
    })

    const byClass = new Map<string, { name: string; count: number }>()
    for (const participant of participants) {
      if (!participant.competitionClass) continue
      const key = String(participant.competitionClass.id)
      const existing = byClass.get(key)
      if (existing) {
        existing.count += 1
      } else {
        byClass.set(key, { name: participant.competitionClass.name, count: 1 })
      }
    }

    const classes = [...byClass.values()]
      .map((entry) => ({
        competitionClassName: entry.name,
        participantCount: entry.count,
        fileCount: Math.ceil(entry.count / MAX_PARTICIPANTS_PER_ZIP),
      }))
      .sort((a, b) => a.competitionClassName.localeCompare(b.competitionClassName))

    return {
      completedParticipants: classes.reduce((sum, c) => sum + c.participantCount, 0),
      totalFiles: classes.reduce((sum, c) => sum + c.fileCount, 0),
      classes,
    }
  })

  return ZipFilesService.of({
    getZipSubmissionStats,
    getZipDownloadUrls,
    initializeZipDownloads,
    getActiveProcess,
    cancelDownloadProcess,
    generateParticipantZip,
    getParticipantZipDownloadUrl,
    getExportFiles,
    retryExportChunk,
    getExportPreview,
  })
})

export const ZipFilesServiceLayerNoDeps = Layer.effect(ZipFilesService, makeZipFilesService)

export const ZipFilesServiceLayer = ZipFilesServiceLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(
      DbLayer,
      DownloadStateRepositoryLayer,
      S3ServiceLayer,
      EnsureParticipantZipLayer,
      ZipDownloadCleanupLayer,
      ZipDownloaderTriggerLayer,
    ),
  ),
)
