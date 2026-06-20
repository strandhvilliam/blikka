import { S3Service, S3ServiceLayer, S3ClientError } from '@blikka/aws'
import {
  DbLayer,
  DbError,
  ExportJobsRepository,
  MarathonsRepository,
  ParticipantsRepository,
  ZippedSubmissionsRepository,
  type ExportJobChunkInput,
  type ExportJobStatus,
} from '@blikka/db'
import {
  EnsureParticipantZip,
  EnsureParticipantZipLayer,
  type ZipWorkerError,
} from '@blikka/uploads/ensure-participant-zip'
import { Effect, Option, Config, Context, Layer } from 'effect'

import { BadRequestError, ConflictError, NotFoundError, failNotFoundIfNone } from '../errors'
import type {
  CancelDownloadProcessInput,
  GenerateParticipantZipInput,
  GetExportFilesInput,
  GetParticipantZipDownloadUrlInput,
  GetZipSubmissionStatusInput,
  InitializeZipDownloadsInput,
  RetryExportChunkInput,
} from './contracts'
import { planZipDownload } from './zip-download-plan'
import {
  UnableToRunZipDownloaderTaskError,
  ZipDownloaderTrigger,
  ZipDownloaderTriggerLayer,
} from './trigger-zip-downloader-job'

// Each chunk runs in one ECS task that, on a cold cache, both generates the missing
// per-participant zips (downloading originals) AND merges them. Keep this modest so peak
// memory/time per task stays bounded. See docs/upload-pipeline-scaling.md.
const MAX_PARTICIPANTS_PER_ZIP = 100

interface ZipSubmissionStats {
  totalParticipants: number
  withZippedSubmissions: number
  missingReferences: string[]
}

export type ExportFileStatus = 'building' | 'ready' | 'failed'

/** One downloadable archive (= one chunk), with its live build status and a URL once ready. */
export interface ExportFileRow {
  /** The numeric export_job_chunks id, as a string (passed back to retry a failed file). */
  jobId: string
  competitionClassName: string
  minReference: number
  maxReference: number
  status: ExportFileStatus
  downloadUrl?: string
}

/** Live view of the latest export's files — the single source for the file-list UI. */
export interface ExportFilesView {
  /** The numeric export_jobs id, as a string. */
  exportJobId: string
  status: ExportJobStatus
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
      exportJobId?: undefined
    }
  | {
      message: string
      exportJobId: string
      domain: string
      totalCompetitionClasses: number
      totalChunks: number
    }

type InitializeZipDownloadsError = DbError | BadRequestError | ConflictError

const DOWNLOAD_URL_EXPIRES_IN_SECONDS = 86400

/** Map a chunk's persisted build status onto the three-state view status (pending shows as building). */
function toExportFileStatus(chunkStatus: string): ExportFileStatus {
  if (chunkStatus === 'ready') return 'ready'
  if (chunkStatus === 'failed') return 'failed'
  return 'building'
}

export class ZipFilesService extends Context.Service<
  ZipFilesService,
  {
    /** Counts participants vs zipped rows and lists references still missing zips. */
    readonly getZipSubmissionStats: (
      input: GetZipSubmissionStatusInput,
    ) => Effect.Effect<ZipSubmissionStats, DbError, never>

    /**
     * Plans chunk jobs per competition class, persists the export job + chunk rows, and triggers
     * one ECS zip-downloader task per chunk.
     */
    readonly initializeZipDownloads: (
      input: InitializeZipDownloadsInput,
    ) => Effect.Effect<InitializeZipDownloadsResult, InitializeZipDownloadsError, never>

    /**
     * Hard-deletes an export job (cascade drops its chunks) and removes the archive objects from S3
     * so a new export can be started.
     */
    readonly cancelDownloadProcess: (
      input: CancelDownloadProcessInput,
    ) => Effect.Effect<
      { success: boolean; message: string; deletedZipKeys?: readonly string[] },
      DbError | S3ClientError | Config.ConfigError,
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
      | DbError
      | BadRequestError
      | NotFoundError
      | S3ClientError
      | Config.ConfigError
      | ZipWorkerError,
      never
    >

    /**
     * Live per-file view of the latest export: each chunk's class, reference range, build status,
     * and a presigned URL as soon as it is ready (download-as-ready). Null when the marathon has
     * never run an export.
     */
    readonly getExportFiles: (
      input: GetExportFilesInput,
    ) => Effect.Effect<ExportFilesView | null, DbError | S3ClientError | Config.ConfigError, never>

    /** Re-queue a single failed chunk: flip it back to building and re-trigger its ECS job. */
    readonly retryExportChunk: (
      input: RetryExportChunkInput,
    ) => Effect.Effect<
      { success: boolean },
      DbError | BadRequestError | UnableToRunZipDownloaderTaskError | Config.ConfigError,
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
  const marathonsRepository = yield* MarathonsRepository
  const exportJobsRepository = yield* ExportJobsRepository
  const s3Service = yield* S3Service
  const ensureParticipantZip = yield* EnsureParticipantZip
  const zipDownloaderTrigger = yield* ZipDownloaderTrigger
  const zipsBucket = yield* Config.string('ZIPS_BUCKET_NAME')

  const resolveMarathonId = (domain: string) =>
    marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(Effect.map(Option.map((marathon) => marathon.id)))

  const getZipSubmissionStats: ZipFilesService['Service']['getZipSubmissionStats'] = Effect.fn(
    'ZipFilesService.getZipSubmissionStats',
  )(function* ({ domain }) {
    return yield* zippedSubmissionsRepository.getZipSubmissionStatsByDomain({ domain })
  })

  const initializeZipDownloads: ZipFilesService['Service']['initializeZipDownloads'] = Effect.fn(
    'ZipFilesService.initializeZipDownloads',
  )(function* ({ domain }) {
    // Source the participant set from the participants table, not zipped_submissions: zips are
    // now generated lazily at download time, so no zip rows exist until the downloader runs.
    const completedParticipants =
      yield* zippedSubmissionsRepository.getCompletedParticipantsForZipPlanning({ domain })

    if (completedParticipants.length === 0) {
      yield* Effect.logInfo({ message: 'No completed participants found for domain', domain })
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

    const marathonIdOption = yield* resolveMarathonId(domain)
    if (Option.isNone(marathonIdOption)) {
      return yield* Effect.fail(
        new BadRequestError({ message: `No marathon found for domain ${domain}` }),
      )
    }
    const marathonId = marathonIdOption.value

    // Concurrency guard: one in-flight export per marathon. The partial unique index is the DB
    // backstop; this pre-check returns a clean ConflictError for the common case.
    const processingJobOption = yield* exportJobsRepository.findProcessingJob({ marathonId })
    if (Option.isSome(processingJobOption)) {
      return yield* Effect.fail(
        new ConflictError({
          message: 'A zip export is already in progress for this marathon.',
          cause: { exportJobId: processingJobOption.value.id },
        }),
      )
    }

    const chunkInputs: ExportJobChunkInput[] = plan.chunkJobs.map((chunkJob) => ({
      competitionClassId: chunkJob.competitionClassId,
      competitionClassName: chunkJob.competitionClassName,
      minReference: Number(chunkJob.minParticipantReference),
      maxReference: Number(chunkJob.maxParticipantReference),
      zipKey: chunkJob.zipKey,
      chunkIndex: chunkJob.chunkIndex,
      classTotalChunks: chunkJob.classTotalChunks,
    }))

    const { job, chunks } = yield* exportJobsRepository.createJobWithChunks({
      marathonId,
      chunks: chunkInputs,
    })

    yield* Effect.logInfo({
      message: 'Export job created',
      exportJobId: job.id,
      domain,
      marathonId,
      totalChunks: plan.totalChunksAcrossAllClasses,
      competitionClassesCount: plan.competitionClasses.length,
    })

    // Trigger one ECS task per chunk (JOB_ID = chunk id). A trigger failure marks ONLY that chunk
    // failed (retryable) and recomputes the job — it never deletes the job, so a successfully
    // initialized export is never rolled back.
    yield* Effect.forEach(
      chunks,
      (chunk) =>
        zipDownloaderTrigger.triggerJob(String(chunk.id)).pipe(
          Effect.catch((error) =>
            Effect.gen(function* () {
              yield* Effect.logError({
                message: 'Failed to trigger zip downloader task for chunk',
                exportJobId: job.id,
                chunkId: chunk.id,
                error: error instanceof Error ? error.message : String(error),
              })
              yield* exportJobsRepository
                .applyChunkResult({ chunkId: chunk.id, status: 'failed' })
                .pipe(Effect.ignore)
            }),
          ),
        ),
      { concurrency: 'unbounded' },
    )

    return {
      message: 'Zip download jobs initialized',
      exportJobId: String(job.id),
      domain,
      totalCompetitionClasses: plan.competitionClasses.length,
      totalChunks: plan.totalChunksAcrossAllClasses,
    }
  })

  const cancelDownloadProcess: ZipFilesService['Service']['cancelDownloadProcess'] = Effect.fn(
    'ZipFilesService.cancelDownloadProcess',
  )(function* ({ domain, exportJobId }) {
    const marathonIdOption = yield* resolveMarathonId(domain)
    if (Option.isNone(marathonIdOption)) {
      return { success: true, message: 'Export already cleared' }
    }

    const jobOption = yield* exportJobsRepository.getLatestJobForMarathon({
      marathonId: marathonIdOption.value,
    })
    if (Option.isNone(jobOption) || String(jobOption.value.id) !== exportJobId) {
      return { success: true, message: 'Export already cleared' }
    }
    const job = jobOption.value

    if (job.status === 'completed') {
      return {
        success: false,
        message: 'Completed exports cannot be reset. Start a new export instead.',
      }
    }

    const chunks = yield* exportJobsRepository.getJobChunks({ jobId: job.id })
    const zipKeys = [...new Set(chunks.map((chunk) => chunk.zipKey))]

    yield* Effect.forEach(
      zipKeys,
      (zipKey) =>
        s3Service.deleteFile(zipsBucket, zipKey).pipe(
          Effect.tap(() =>
            Effect.logInfo({ message: 'Deleted partial marathon zip export object', zipKey }),
          ),
          Effect.catch((error) =>
            Effect.logWarning({
              message: 'Failed to delete partial marathon zip export object',
              zipKey,
              error: error instanceof Error ? error.message : String(error),
            }),
          ),
        ),
      { concurrency: 5 },
    )

    yield* exportJobsRepository.deleteJob({ jobId: job.id })

    yield* Effect.logInfo({
      message: 'Export job reset',
      exportJobId: job.id,
      domain,
      deletedZipKeys: zipKeys.length,
    })

    const deletedCount = zipKeys.length
    return {
      success: true,
      message:
        deletedCount > 0
          ? `Export reset and ${deletedCount} partial ${deletedCount === 1 ? 'file' : 'files'} removed.`
          : 'Export reset. You can start a new export.',
      deletedZipKeys: zipKeys,
    }
  })

  const getParticipantZipDownloadUrl: ZipFilesService['Service']['getParticipantZipDownloadUrl'] =
    Effect.fn('ZipFilesService.getParticipantZipDownloadUrl')(function* ({ domain, reference }) {
      const participant = yield* participantsRepository
        .getParticipantByReference({ reference, domain })
        .pipe(failNotFoundIfNone('Participant', { reference, domain }))

      if (participant.submissions.length === 0) {
        return yield* Effect.fail(
          new BadRequestError({ message: 'Participant has no submissions to zip' }),
        )
      }

      // Generate the participant zip on demand (reuses the cached zip if it already exists).
      const { key } = yield* ensureParticipantZip.ensureParticipantZip({ domain, reference })

      const downloadUrl = yield* s3Service.getPresignedUrl(zipsBucket, key, 'GET', {
        expiresIn: 3600,
      })

      return { downloadUrl, filename: `${reference}.zip` }
    })

  const generateParticipantZip: ZipFilesService['Service']['generateParticipantZip'] = Effect.fn(
    'ZipFilesService.generateParticipantZip',
  )(function* ({ domain, reference }) {
    const participant = yield* participantsRepository
      .getParticipantByReference({ reference, domain })
      .pipe(failNotFoundIfNone('Participant', { reference, domain }))

    if (participant.submissions.length === 0) {
      return yield* Effect.fail(
        new BadRequestError({ message: 'Participant has no submissions to zip' }),
      )
    }

    const { key } = yield* ensureParticipantZip.ensureParticipantZip({ domain, reference })

    return { success: true, key }
  })

  const getExportFiles: ZipFilesService['Service']['getExportFiles'] = Effect.fn(
    'ZipFilesService.getExportFiles',
  )(function* ({ domain }) {
    const marathonIdOption = yield* resolveMarathonId(domain)
    if (Option.isNone(marathonIdOption)) {
      return null
    }

    // Latest-job-wins, durable: the most recent export job for the marathon is the source of truth.
    // Null only when this marathon has never run an export — nothing to evaporate.
    const jobOption = yield* exportJobsRepository.getLatestJobForMarathon({
      marathonId: marathonIdOption.value,
    })
    if (Option.isNone(jobOption)) {
      return null
    }
    const job = jobOption.value

    const chunks = yield* exportJobsRepository.getJobChunks({ jobId: job.id })

    const files = yield* Effect.forEach(
      chunks,
      (chunk) => {
        const status = toExportFileStatus(chunk.status)
        const base: ExportFileRow = {
          jobId: String(chunk.id),
          competitionClassName: chunk.competitionClassName,
          minReference: chunk.minReference,
          maxReference: chunk.maxReference,
          status,
        }

        if (status === 'ready') {
          return s3Service
            .getPresignedUrl(zipsBucket, chunk.zipKey, 'GET', {
              expiresIn: DOWNLOAD_URL_EXPIRES_IN_SECONDS,
            })
            .pipe(Effect.map((downloadUrl): ExportFileRow => ({ ...base, downloadUrl })))
        }
        return Effect.succeed(base)
      },
      { concurrency: 10 },
    )

    return {
      exportJobId: String(job.id),
      status: job.status as ExportJobStatus,
      totalChunks: job.totalChunks,
      completedChunks: job.completedChunks,
      failedChunks: job.failedChunks,
      lastUpdatedAt: job.updatedAt ?? job.createdAt,
      files,
    }
  })

  const retryExportChunk: ZipFilesService['Service']['retryExportChunk'] = Effect.fn(
    'ZipFilesService.retryExportChunk',
  )(function* ({ domain, exportJobId, jobId }) {
    const marathonIdOption = yield* resolveMarathonId(domain)
    if (Option.isNone(marathonIdOption)) {
      return yield* Effect.fail(
        new BadRequestError({ message: 'This file is no longer available to retry.' }),
      )
    }

    const jobOption = yield* exportJobsRepository.getLatestJobForMarathon({
      marathonId: marathonIdOption.value,
    })
    if (Option.isNone(jobOption) || String(jobOption.value.id) !== exportJobId) {
      return yield* Effect.fail(
        new BadRequestError({ message: 'This file does not belong to the current export.' }),
      )
    }
    const job = jobOption.value

    const chunkOption = yield* exportJobsRepository.getChunk({ chunkId: Number(jobId) })
    if (Option.isNone(chunkOption) || chunkOption.value.exportJobId !== job.id) {
      return yield* Effect.fail(
        new BadRequestError({ message: 'This file is no longer available to retry.' }),
      )
    }
    const chunk = chunkOption.value

    if (chunk.status !== 'failed') {
      return yield* Effect.fail(
        new BadRequestError({ message: 'Only failed files can be retried.' }),
      )
    }

    // Flip the chunk back to building; the unguarded recompute pulls the job out of its terminal
    // state into 'processing' (a legitimate backwards move, safe because the export already finished).
    yield* exportJobsRepository.reactivateChunkForRetry({ chunkId: chunk.id })
    yield* zipDownloaderTrigger.triggerJob(String(chunk.id))

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
    initializeZipDownloads,
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
    Layer.mergeAll(DbLayer, S3ServiceLayer, EnsureParticipantZipLayer, ZipDownloaderTriggerLayer),
  ),
)
