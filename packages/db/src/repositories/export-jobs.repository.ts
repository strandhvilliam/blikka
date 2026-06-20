import { Context, Effect, Layer, Option } from 'effect'
import { eq, sql } from 'drizzle-orm'

import { DrizzleClient } from '../drizzle-client'
import { exportJobChunks, exportJobs } from '../schema'
import type { ExportJob, ExportJobChunk } from '../types'
import { DbError } from '../utils'

/** Lifecycle status of an export job — derived from the aggregate of its chunk rows. */
export type ExportJobStatus = 'processing' | 'completed' | 'failed' | 'cancelled'

/** Build status of a single downloadable archive (chunk). */
export type ExportJobChunkStatus = 'pending' | 'building' | 'ready' | 'failed'

/** A planned chunk, before it is persisted (the job id is assigned by `createJobWithChunks`). */
export interface ExportJobChunkInput {
  readonly competitionClassId: number
  readonly competitionClassName: string
  readonly minReference: number
  readonly maxReference: number
  readonly zipKey: string
  readonly chunkIndex: number
  readonly classTotalChunks: number
}

export interface CreateJobWithChunksResult {
  readonly job: ExportJob
  readonly chunks: ExportJobChunk[]
}

export class ExportJobsRepository extends Context.Service<
  ExportJobsRepository,
  {
    /**
     * Insert one `export_jobs` row (status 'processing') plus all its `export_job_chunks`
     * (status 'pending'). If the chunk insert fails the job row is rolled back so no
     * orphaned in-flight job is left behind. The partial unique index on
     * `(marathon_id) WHERE status='processing'` is the DB backstop against concurrent exports.
     */
    readonly createJobWithChunks: (params: {
      marathonId: number
      chunks: readonly ExportJobChunkInput[]
    }) => Effect.Effect<CreateJobWithChunksResult, DbError>

    /** Most recent export job for a marathon (latest-job-wins), or none if it never ran one. */
    readonly getLatestJobForMarathon: (params: {
      marathonId: number
    }) => Effect.Effect<Option.Option<ExportJob>, DbError>

    /** The in-flight ('processing') export job for a marathon, or none. */
    readonly findProcessingJob: (params: {
      marathonId: number
    }) => Effect.Effect<Option.Option<ExportJob>, DbError>

    /** All chunks for a job, ordered by class then reference range. */
    readonly getJobChunks: (params: { jobId: number }) => Effect.Effect<ExportJobChunk[], DbError>

    /** A single chunk by id, or none. */
    readonly getChunk: (params: {
      chunkId: number
    }) => Effect.Effect<Option.Option<ExportJobChunk>, DbError>

    /**
     * A chunk by id together with its marathon `domain` (joined through job → marathon). The ECS
     * zip-downloader needs the domain to enumerate participants, but it is not stored on the chunk.
     */
    readonly getChunkWithDomain: (params: {
      chunkId: number
    }) => Effect.Effect<Option.Option<{ chunk: ExportJobChunk; domain: string }>, DbError>

    /** Set a chunk's build status, returning the updated row. */
    readonly setChunkStatus: (params: {
      chunkId: number
      status: ExportJobChunkStatus
    }) => Effect.Effect<ExportJobChunk, DbError>

    /**
     * Apply a chunk's TERMINAL result ('ready'/'failed') and recompute the parent job in one
     * helper: set the chunk status, then run the monotonic recompute and return the refreshed job.
     * Safe under concurrent chunk completions (see `recomputeJobStatusMonotonic`).
     */
    readonly applyChunkResult: (params: {
      chunkId: number
      status: ExportJobChunkStatus
    }) => Effect.Effect<Option.Option<ExportJob>, DbError>

    /**
     * Re-queue a single failed chunk for retry: flip it back to 'building' and recompute the job
     * (unguarded, because this legitimately moves the job BACKWARDS out of a terminal state). Only
     * call this from a terminal, non-concurrent state (the export already finished). Returns the
     * refreshed job.
     */
    readonly reactivateChunkForRetry: (params: {
      chunkId: number
    }) => Effect.Effect<Option.Option<ExportJob>, DbError>

    /** Hard-delete a job (cascade drops its chunks). Used for cancel. */
    readonly deleteJob: (params: { jobId: number }) => Effect.Effect<void, DbError>
  }
>()('@blikka/db/export-jobs-repository') {}

const makeExportJobsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const getJobById = Effect.fn('ExportJobsRepository.getJobById')(function* ({
    jobId,
  }: {
    jobId: number
  }) {
    const result = yield* use((db) =>
      db.query.exportJobs.findFirst({
        where: (table, operators) => operators.eq(table.id, jobId),
      }),
    )
    return Option.fromNullishOr(result)
  })

  const createJobWithChunks: ExportJobsRepository['Service']['createJobWithChunks'] = Effect.fn(
    'ExportJobsRepository.createJobWithChunks',
  )(function* ({ marathonId, chunks }) {
    const [job] = yield* use((db) =>
      db
        .insert(exportJobs)
        .values({ marathonId, status: 'processing', totalChunks: chunks.length })
        .returning(),
    )
    if (!job) {
      return yield* Effect.fail(new DbError({ message: 'Failed to create export job' }))
    }

    const insertedChunks = yield* use((db) =>
      db
        .insert(exportJobChunks)
        .values(
          chunks.map((chunk) => ({
            exportJobId: job.id,
            competitionClassId: chunk.competitionClassId,
            competitionClassName: chunk.competitionClassName,
            minReference: chunk.minReference,
            maxReference: chunk.maxReference,
            zipKey: chunk.zipKey,
            status: 'pending' as const,
            chunkIndex: chunk.chunkIndex,
            classTotalChunks: chunk.classTotalChunks,
          })),
        )
        .returning(),
    ).pipe(
      // neon-http has no interactive transactions, so the job and chunk inserts are separate
      // statements. If the chunk insert fails, drop the job row so we never strand an in-flight
      // 'processing' job with no chunks (which the partial unique index would then pin forever).
      Effect.tapError(() =>
        use((db) => db.delete(exportJobs).where(eq(exportJobs.id, job.id))).pipe(Effect.ignore),
      ),
    )

    return { job, chunks: insertedChunks }
  })

  const getLatestJobForMarathon: ExportJobsRepository['Service']['getLatestJobForMarathon'] =
    Effect.fn('ExportJobsRepository.getLatestJobForMarathon')(function* ({ marathonId }) {
      const result = yield* use((db) =>
        db.query.exportJobs.findFirst({
          where: (table, operators) => operators.eq(table.marathonId, marathonId),
          // Order by the identity PK, not createdAt: ids are strictly monotonic with insert order,
          // so this is a stable "latest job" even if two jobs share a created_at timestamp.
          orderBy: (table, { desc }) => desc(table.id),
        }),
      )
      return Option.fromNullishOr(result)
    })

  const findProcessingJob: ExportJobsRepository['Service']['findProcessingJob'] = Effect.fn(
    'ExportJobsRepository.findProcessingJob',
  )(function* ({ marathonId }) {
    const result = yield* use((db) =>
      db.query.exportJobs.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.marathonId, marathonId),
            operators.eq(table.status, 'processing'),
          ),
      }),
    )
    return Option.fromNullishOr(result)
  })

  const getJobChunks: ExportJobsRepository['Service']['getJobChunks'] = Effect.fn(
    'ExportJobsRepository.getJobChunks',
  )(function* ({ jobId }) {
    return yield* use((db) =>
      db.query.exportJobChunks.findMany({
        where: (table, operators) => operators.eq(table.exportJobId, jobId),
        orderBy: (table, { asc }) => [asc(table.competitionClassName), asc(table.minReference)],
      }),
    )
  })

  const getChunk: ExportJobsRepository['Service']['getChunk'] = Effect.fn(
    'ExportJobsRepository.getChunk',
  )(function* ({ chunkId }) {
    const result = yield* use((db) =>
      db.query.exportJobChunks.findFirst({
        where: (table, operators) => operators.eq(table.id, chunkId),
      }),
    )
    return Option.fromNullishOr(result)
  })

  const getChunkWithDomain: ExportJobsRepository['Service']['getChunkWithDomain'] = Effect.fn(
    'ExportJobsRepository.getChunkWithDomain',
  )(function* ({ chunkId }) {
    const result = yield* use((db) =>
      db.query.exportJobChunks.findFirst({
        where: (table, operators) => operators.eq(table.id, chunkId),
        with: {
          exportJob: {
            with: {
              marathon: { columns: { domain: true } },
            },
          },
        },
      }),
    )
    if (!result) {
      return Option.none()
    }
    const { exportJob, ...chunk } = result
    return Option.some({ chunk, domain: exportJob.marathon.domain })
  })

  const setChunkStatus: ExportJobsRepository['Service']['setChunkStatus'] = Effect.fn(
    'ExportJobsRepository.setChunkStatus',
  )(function* ({ chunkId, status }) {
    const [result] = yield* use((db) =>
      db
        .update(exportJobChunks)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(exportJobChunks.id, chunkId))
        .returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({ message: `Failed to update export job chunk ${chunkId}` }),
      )
    }
    return result
  })

  // Recompute counters/status from the chunk rows in ONE statement (read + write together).
  //
  // `monotonic` guards the write with `(ready + failed) > current recorded total`. This matters
  // under READ COMMITTED: when two chunk-completion recomputes contend on the same job row, the
  // loser blocks, then re-evaluates — but its non-correlated `c` subquery keeps the ORIGINAL
  // snapshot's (stale, lower) counts while `j.*` is re-read fresh via EvalPlanQual. The guard makes
  // such a stale writer either skip or only ever move FORWARD, so it can never overwrite a correct
  // terminal status with a stale 'processing'. The final all-terminal recompute strictly exceeds
  // any in-flight recorded sum, so terminal status always lands. Retry needs the UNGUARDED form
  // because it legitimately moves the job backwards out of a terminal state (and runs alone).
  const runRecompute = (jobId: number, monotonic: boolean) =>
    use((db) =>
      db.execute(sql`
        update ${exportJobs} as j set
          completed_chunks = c.ready,
          failed_chunks = c.failed,
          status = case
            when c.ready + c.failed >= j.total_chunks
              then case when c.failed > 0 then 'failed' else 'completed' end
            else 'processing'
          end,
          updated_at = now()
        from (
          select
            count(*) filter (where status = 'ready')::int as ready,
            count(*) filter (where status = 'failed')::int as failed
          from ${exportJobChunks}
          where export_job_id = ${jobId}
        ) as c
        where j.id = ${jobId}
        ${monotonic ? sql`and c.ready + c.failed > j.completed_chunks + j.failed_chunks` : sql``}
      `),
    )

  const applyChunkResult: ExportJobsRepository['Service']['applyChunkResult'] = Effect.fn(
    'ExportJobsRepository.applyChunkResult',
  )(function* ({ chunkId, status }) {
    const chunk = yield* setChunkStatus({ chunkId, status })
    yield* runRecompute(chunk.exportJobId, true)
    return yield* getJobById({ jobId: chunk.exportJobId })
  })

  const reactivateChunkForRetry: ExportJobsRepository['Service']['reactivateChunkForRetry'] =
    Effect.fn('ExportJobsRepository.reactivateChunkForRetry')(function* ({ chunkId }) {
      const chunk = yield* setChunkStatus({ chunkId, status: 'building' })
      yield* runRecompute(chunk.exportJobId, false)
      return yield* getJobById({ jobId: chunk.exportJobId })
    })

  const deleteJob: ExportJobsRepository['Service']['deleteJob'] = Effect.fn(
    'ExportJobsRepository.deleteJob',
  )(function* ({ jobId }) {
    yield* use((db) => db.delete(exportJobs).where(eq(exportJobs.id, jobId)))
  })

  return ExportJobsRepository.of({
    createJobWithChunks,
    getLatestJobForMarathon,
    findProcessingJob,
    getJobChunks,
    getChunk,
    getChunkWithDomain,
    setChunkStatus,
    applyChunkResult,
    reactivateChunkForRetry,
    deleteJob,
  })
})

export const ExportJobsRepositoryLayerNoDeps = Layer.effect(
  ExportJobsRepository,
  makeExportJobsRepository,
)

export const ExportJobsRepositoryLayer = ExportJobsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
