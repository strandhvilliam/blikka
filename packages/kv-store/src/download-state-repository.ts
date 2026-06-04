import {
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Schedule,
  Schema,
  SchemaTransformation,
} from 'effect'
import { RedisClient, RedisClientLayer } from '@blikka/redis'
import { Keys } from './key-factory'
import { atomicIncrementCompletedScript } from './lua-scripts/atomic-increment-completed-script'
import { atomicIncrementFailedScript } from './lua-scripts/atomic-increment-failed-script'
import { atomicAddJobScript } from './lua-scripts/atomic-add-job-script'

export const DownloadProcessStatusSchema = Schema.Literals([
  'initializing',
  'processing',
  'completed',
  'failed',
  'cancelled',
])

export const ChunkStateSchema = Schema.Struct({
  processId: Schema.String,
  domain: Schema.String,
  competitionClassId: Schema.Number,
  competitionClassName: Schema.String,
  minReference: Schema.Number,
  maxReference: Schema.Number,
  zipKey: Schema.String,
  chunkIndex: Schema.Number,
  /** Chunk count for this competition class (metadata only). */
  classTotalChunks: Schema.Number,
  /** Marathon-wide chunk count used for process completion in atomic counters. */
  processTotalChunks: Schema.Number,
})

export const DownloadProcessStateSchema = Schema.Struct({
  processId: Schema.String,
  domain: Schema.String,
  createdAt: Schema.String,
  lastUpdatedAt: Schema.String,
  status: DownloadProcessStatusSchema,
  totalChunks: Schema.Number,
  completedChunks: Schema.Number,
  failedChunks: Schema.Number,
  jobIds: Schema.Array(Schema.String),
  failedJobIds: Schema.Array(Schema.String),
  competitionClasses: Schema.Array(
    Schema.Struct({
      competitionClassId: Schema.Number,
      competitionClassName: Schema.String,
      totalChunks: Schema.Number,
    }),
  ),
})

export const StringArrayFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Array(Schema.String),
    SchemaTransformation.transform({
      decode: (s) => (s === '' ? ([] as readonly string[]) : (s.split(',') as readonly string[])),
      encode: (arr) => arr.join(','),
    }),
  ),
)

const AtomicIncrementResultSchema = Schema.Struct({
  completedChunks: Schema.Number,
  failedChunks: Schema.Number,
  status: DownloadProcessStatusSchema,
})

interface AtomicIncrementResult {
  completedChunks: number
  failedChunks: number
  status: DownloadProcessStatus
}

const decodeStringArray = Schema.decodeSync(StringArrayFromString)

/** jobIds are stored as JSON arrays (add-job script) or comma-separated strings (legacy). */
export const parseJobIdsField = (value: unknown): readonly string[] => {
  if (value == null || value === '') {
    return []
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }

  if (typeof value !== 'string') {
    return []
  }

  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string')
      }
    } catch {
      return []
    }
  }

  return decodeStringArray(trimmed)
}

export class DownloadStateStoreUnavailable extends Schema.TaggedErrorClass<DownloadStateStoreUnavailable>()(
  'DownloadStateStoreUnavailable',
  {
    operation: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class DownloadProcessNotFound extends Schema.TaggedErrorClass<DownloadProcessNotFound>()(
  'DownloadProcessNotFound',
  {
    processId: Schema.String,
  },
) {}

export class DownloadStateScriptFailed extends Schema.TaggedErrorClass<DownloadStateScriptFailed>()(
  'DownloadStateScriptFailed',
  {
    operation: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class DownloadStateInvariantViolated extends Schema.TaggedErrorClass<DownloadStateInvariantViolated>()(
  'DownloadStateInvariantViolated',
  {
    reason: Schema.Literal('unexpected_atomic_increment_payload'),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type DownloadStateRepositoryError =
  | DownloadStateStoreUnavailable
  | DownloadProcessNotFound
  | DownloadStateScriptFailed
  | DownloadStateInvariantViolated

export type DownloadProcessStatus = typeof DownloadProcessStatusSchema.Type
export type ChunkState = typeof ChunkStateSchema.Type
export type DownloadProcessState = typeof DownloadProcessStateSchema.Type

const CHUNK_TTL_SECONDS = 21600
const PROCESS_TTL_SECONDS = 172800
const ACTIVE_PROCESS_TTL_SECONDS = 172800

/** Redis-backed persistence for bulk download jobs: per-chunk state, process aggregates, and domain-active pointers. */
export class DownloadStateRepository extends Context.Service<
  DownloadStateRepository,
  {
    /** Persist chunk-level download fields for a job and refresh the chunk key TTL. */
    readonly saveChunkState: (
      jobId: string,
      state: ChunkState,
    ) => Effect.Effect<string, DownloadStateRepositoryError>
    /** Load parsed chunk state for a job, or `None` when the key is missing or empty. */
    readonly getChunkState: (
      jobId: string,
    ) => Effect.Effect<Option.Option<ChunkState>, DownloadStateRepositoryError>
    /** Create a new download process hash with zeroed counters and `initializing` status. */
    readonly createDownloadProcess: (
      processId: string,
      domain: string,
      totalChunks: number,
    ) => Effect.Effect<string, DownloadStateRepositoryError>
    /** Read the full download process aggregate, or `None` if absent. */
    readonly getDownloadProcess: (
      processId: string,
    ) => Effect.Effect<Option.Option<DownloadProcessState>, DownloadStateRepositoryError>
    /** Merge partial fields into an existing process and bump `lastUpdatedAt`; fails if the process does not exist. */
    readonly updateDownloadProcess: (
      processId: string,
      updates: Partial<Omit<DownloadProcessState, 'processId' | 'domain' | 'createdAt'>>,
    ) => Effect.Effect<string, DownloadStateRepositoryError>
    /** Atomically increment the completed-chunk counter and derive status (e.g. finished when all chunks complete). */
    readonly atomicIncrementCompleted: (
      processId: string,
      totalChunks: number,
    ) => Effect.Effect<AtomicIncrementResult, DownloadStateRepositoryError>
    /** Atomically increment the failed-chunk counter, append `failedJobId`, and refresh derived status. */
    readonly atomicIncrementFailed: (
      processId: string,
      totalChunks: number,
      failedJobId: string,
    ) => Effect.Effect<AtomicIncrementResult, DownloadStateRepositoryError>
    /** Atomically register a chunk/job id on the process and refresh timestamps and TTL. */
    readonly addJobToProcess: (
      processId: string,
      jobId: string,
    ) => Effect.Effect<string, DownloadStateRepositoryError>
    /** Return all job ids associated with the process (empty when unset). */
    readonly getProcessJobIds: (
      processId: string,
    ) => Effect.Effect<readonly string[], DownloadStateRepositoryError>
    /** Resolve which download process id is currently marked active for a domain, if any. */
    readonly getActiveProcessForDomain: (
      domain: string,
    ) => Effect.Effect<Option.Option<string>, DownloadStateRepositoryError>
    /** Point a domain at an active process id with expiry (coordination / single-flight style). */
    readonly setActiveProcessForDomain: (
      domain: string,
      processId: string,
    ) => Effect.Effect<string | null, DownloadStateRepositoryError>
    /** Remove the domain's active-process pointer (returns number of keys deleted). */
    readonly clearActiveProcessForDomain: (
      domain: string,
    ) => Effect.Effect<number, DownloadStateRepositoryError>
    /** Mark an existing process as `cancelled`; fails if the process hash is missing. */
    readonly cancelDownloadProcess: (
      processId: string,
    ) => Effect.Effect<string, DownloadStateRepositoryError>
    /** Remove chunk-level state for a job id. */
    readonly deleteChunkState: (
      jobId: string,
    ) => Effect.Effect<number, DownloadStateRepositoryError>
    /** Remove the process aggregate hash. */
    readonly deleteDownloadProcess: (
      processId: string,
    ) => Effect.Effect<number, DownloadStateRepositoryError>
    /** True when status is `initializing` or `processing`; false when absent or any terminal/other status. */
    readonly isProcessActive: (
      processId: string,
    ) => Effect.Effect<boolean, DownloadStateRepositoryError>
  }
>()('@blikka/packages/kv-store/download-state-repository') {}

const makeDownloadStateRepository = Effect.gen(function* () {
  const redis = yield* RedisClient

  const retryPolicy = Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))

  const saveChunkState: DownloadStateRepository['Service']['saveChunkState'] = Effect.fn(
    'DownloadStateRepository.saveChunkState',
  )(
    function* (jobId, state) {
      const key = Keys.downloadState(jobId)
      yield* redis.use((client) => client.hset(key, state))
      yield* redis.use((client) => client.expire(key, CHUNK_TTL_SECONDS))
      return 'OK'
    },
    Effect.retry(retryPolicy),
    Effect.catchTag('RedisError', (e) =>
      Effect.fail(new DownloadStateStoreUnavailable({ operation: 'saveChunkState', cause: e })),
    ),
    (effect, jobId) => Effect.annotateLogs(effect, { jobId }),
  )

  const getChunkState: DownloadStateRepository['Service']['getChunkState'] = Effect.fn(
    'DownloadStateRepository.getChunkState',
  )(
    function* (jobId) {
      yield* Effect.logInfo({
        message: 'Getting chunk state',
        jobId,
      })

      const key = Keys.downloadState(jobId)
      const result = yield* redis.use((client) => client.hgetall(key))

      yield* Effect.logInfo({
        message: 'Result',
        result,
      })

      if (!result || Object.keys(result).length === 0) {
        return Option.none<ChunkState>()
      }

      return Schema.decodeUnknownOption(ChunkStateSchema)(result)
    },
    Effect.retry(retryPolicy),
    Effect.catchTag('RedisError', (e) =>
      Effect.fail(new DownloadStateStoreUnavailable({ operation: 'getChunkState', cause: e })),
    ),
    (effect, jobId) => Effect.annotateLogs(effect, { jobId }),
  )

  const createDownloadProcess: DownloadStateRepository['Service']['createDownloadProcess'] =
    Effect.fn('DownloadStateRepository.createDownloadProcess')(
      function* (processId, domain, totalChunks) {
        const now = new Date().toISOString()
        const key = Keys.downloadProcess(processId)

        const initialState: DownloadProcessState = {
          processId,
          domain,
          createdAt: now,
          lastUpdatedAt: now,
          status: 'initializing',
          totalChunks,
          completedChunks: 0,
          failedChunks: 0,
          jobIds: [],
          failedJobIds: [],
          competitionClasses: [],
        }

        yield* redis.use((client) => client.hset(key, initialState))
        yield* redis.use((client) => client.expire(key, PROCESS_TTL_SECONDS))

        return 'OK'
      },
      Effect.retry(retryPolicy),
      Effect.catchTag('RedisError', (e) =>
        Effect.fail(
          new DownloadStateStoreUnavailable({ operation: 'createDownloadProcess', cause: e }),
        ),
      ),
      (effect, processId, domain, totalChunks) =>
        Effect.annotateLogs(effect, { processId, domain, totalChunks }),
    )

  const getDownloadProcess: DownloadStateRepository['Service']['getDownloadProcess'] = Effect.fn(
    'DownloadStateRepository.getDownloadProcess',
  )(
    function* (processId) {
      const key = Keys.downloadProcess(processId)
      const result = yield* redis.use((client) => client.hgetall(key))

      if (!result || Object.keys(result).length === 0) {
        return Option.none<DownloadProcessState>()
      }

      return Schema.decodeUnknownOption(DownloadProcessStateSchema)(result)
    },
    Effect.retry(retryPolicy),
    Effect.catchTag('RedisError', (e) =>
      Effect.fail(new DownloadStateStoreUnavailable({ operation: 'getDownloadProcess', cause: e })),
    ),
    (effect, processId) => Effect.annotateLogs(effect, { processId }),
  )

  const updateDownloadProcess: DownloadStateRepository['Service']['updateDownloadProcess'] =
    Effect.fn('DownloadStateRepository.updateDownloadProcess')(
      function* (processId, updates) {
        yield* Effect.logInfo({
          message: 'Updating download process',
          processId,
          updates,
        })

        const key = Keys.downloadProcess(processId)

        const exists = yield* redis.use((client) => client.exists(key))
        if (!exists) {
          return yield* Effect.fail(new DownloadProcessNotFound({ processId }))
        }

        const currentStateOption = yield* getDownloadProcess(processId)
        if (Option.isNone(currentStateOption)) {
          return yield* Effect.fail(new DownloadProcessNotFound({ processId }))
        }

        const currentState = currentStateOption.value
        yield* Effect.logInfo({
          message: 'Current state',
          processId,
          currentState,
        })
        const updatedState: DownloadProcessState = {
          ...currentState,
          ...updates,
          lastUpdatedAt: new Date().toISOString(),
        }

        yield* redis.use((client) => client.hset(key, updatedState))
        yield* redis.use((client) => client.expire(key, PROCESS_TTL_SECONDS))
        return 'OK'
      },
      Effect.retry(retryPolicy),
      Effect.catchTag('RedisError', (e) =>
        Effect.fail(
          new DownloadStateStoreUnavailable({ operation: 'updateDownloadProcess', cause: e }),
        ),
      ),
      (effect, processId) => Effect.annotateLogs(effect, { processId }),
    )

  const atomicIncrementCompleted: DownloadStateRepository['Service']['atomicIncrementCompleted'] =
    Effect.fn('DownloadStateRepository.atomicIncrementCompleted')(
      function* (processId, totalChunks) {
        const key = Keys.downloadProcess(processId)
        const now = new Date().toISOString()

        const result = yield* Effect.tryPromise({
          try: () =>
            atomicIncrementCompletedScript.run(redis.client, {
              keys: { key },
              args: { totalChunks, now, ttl: PROCESS_TTL_SECONDS },
            }),
          catch: (error) =>
            new DownloadStateScriptFailed({ operation: 'atomicIncrementCompleted', cause: error }),
        })

        if (result === null) {
          return yield* Effect.fail(new DownloadProcessNotFound({ processId }))
        }

        const payload = yield* Effect.try({
          try: () => (typeof result === 'string' ? JSON.parse(result) : result),
          catch: (error) =>
            new DownloadStateInvariantViolated({
              reason: 'unexpected_atomic_increment_payload',
              cause: error,
            }),
        })

        return yield* Schema.decodeUnknownEffect(AtomicIncrementResultSchema)(payload).pipe(
          Effect.mapError(
            (issue) =>
              new DownloadStateInvariantViolated({
                reason: 'unexpected_atomic_increment_payload',
                cause: issue,
              }),
          ),
        )
      },
      Effect.retry(retryPolicy),
      (effect, processId, totalChunks) => Effect.annotateLogs(effect, { processId, totalChunks }),
    )

  const atomicIncrementFailed: DownloadStateRepository['Service']['atomicIncrementFailed'] =
    Effect.fn('DownloadStateRepository.atomicIncrementFailed')(
      function* (processId, totalChunks, failedJobId) {
        const key = Keys.downloadProcess(processId)
        const now = new Date().toISOString()

        const result = yield* Effect.tryPromise({
          try: () =>
            atomicIncrementFailedScript.run(redis.client, {
              keys: { key },
              args: { totalChunks, now, failedJobId, ttl: PROCESS_TTL_SECONDS },
            }),
          catch: (error) =>
            new DownloadStateScriptFailed({ operation: 'atomicIncrementFailed', cause: error }),
        })

        if (result === null) {
          return yield* Effect.fail(new DownloadProcessNotFound({ processId }))
        }

        const payload = yield* Effect.try({
          try: () => (typeof result === 'string' ? JSON.parse(result) : result),
          catch: (error) =>
            new DownloadStateInvariantViolated({
              reason: 'unexpected_atomic_increment_payload',
              cause: error,
            }),
        })

        return yield* Schema.decodeUnknownEffect(AtomicIncrementResultSchema)(payload).pipe(
          Effect.mapError(
            (issue) =>
              new DownloadStateInvariantViolated({
                reason: 'unexpected_atomic_increment_payload',
                cause: issue,
              }),
          ),
        )
      },
      Effect.retry(retryPolicy),
      (effect, processId, totalChunks, failedJobId) =>
        Effect.annotateLogs(effect, { processId, totalChunks, failedJobId }),
    )

  const addJobToProcess: DownloadStateRepository['Service']['addJobToProcess'] = Effect.fn(
    'DownloadStateRepository.addJobToProcess',
  )(
    function* (processId, jobId) {
      const key = Keys.downloadProcess(processId)
      const now = new Date().toISOString()

      const result = yield* Effect.tryPromise({
        try: () =>
          atomicAddJobScript.run(redis.client, {
            keys: { key },
            args: { jobId, now, ttl: PROCESS_TTL_SECONDS },
          }),
        catch: (error) =>
          new DownloadStateScriptFailed({ operation: 'addJobToProcess', cause: error }),
      })

      if (result === null) {
        return yield* Effect.fail(new DownloadProcessNotFound({ processId }))
      }

      return result as string
    },
    Effect.retry(retryPolicy),
    (effect, processId, jobId) => Effect.annotateLogs(effect, { processId, jobId }),
  )

  const getProcessJobIds: DownloadStateRepository['Service']['getProcessJobIds'] = Effect.fn(
    'DownloadStateRepository.getProcessJobIds',
  )(
    function* (processId) {
      const key = Keys.downloadProcess(processId)
      const result = yield* redis.use((client) => client.hget(key, 'jobIds'))
      return parseJobIdsField(result)
    },
    Effect.retry(retryPolicy),
    Effect.catchTag('RedisError', (e) =>
      Effect.fail(new DownloadStateStoreUnavailable({ operation: 'getProcessJobIds', cause: e })),
    ),
    (effect, processId) => Effect.annotateLogs(effect, { processId }),
  )

  const getActiveProcessForDomain: DownloadStateRepository['Service']['getActiveProcessForDomain'] =
    Effect.fn('DownloadStateRepository.getActiveProcessForDomain')(
      function* (domain) {
        const key = Keys.activeDownloadProcess(domain)
        const result = yield* redis.use((client) => client.get<string | null>(key))
        return Option.fromNullishOr(result)
      },
      Effect.retry(retryPolicy),
      Effect.catchTag('RedisError', (e) =>
        Effect.fail(
          new DownloadStateStoreUnavailable({ operation: 'getActiveProcessForDomain', cause: e }),
        ),
      ),
      (effect, domain) => Effect.annotateLogs(effect, { domain }),
    )

  const setActiveProcessForDomain: DownloadStateRepository['Service']['setActiveProcessForDomain'] =
    Effect.fn('DownloadStateRepository.setActiveProcessForDomain')(
      function* (domain, processId) {
        const key = Keys.activeDownloadProcess(domain)
        return yield* redis.use((client) =>
          client.set(key, processId, { ex: ACTIVE_PROCESS_TTL_SECONDS }),
        )
      },
      Effect.retry(retryPolicy),
      Effect.catchTag('RedisError', (e) =>
        Effect.fail(
          new DownloadStateStoreUnavailable({ operation: 'setActiveProcessForDomain', cause: e }),
        ),
      ),
      (effect, domain, processId) => Effect.annotateLogs(effect, { domain, processId }),
    )

  const clearActiveProcessForDomain: DownloadStateRepository['Service']['clearActiveProcessForDomain'] =
    Effect.fn('DownloadStateRepository.clearActiveProcessForDomain')(
      function* (domain) {
        const key = Keys.activeDownloadProcess(domain)
        return yield* redis.use((client) => client.del(key))
      },
      Effect.retry(retryPolicy),
      Effect.catchTag('RedisError', (e) =>
        Effect.fail(
          new DownloadStateStoreUnavailable({ operation: 'clearActiveProcessForDomain', cause: e }),
        ),
      ),
      (effect, domain) => Effect.annotateLogs(effect, { domain }),
    )

  const cancelDownloadProcess: DownloadStateRepository['Service']['cancelDownloadProcess'] =
    Effect.fn('DownloadStateRepository.cancelDownloadProcess')(
      function* (processId) {
        const key = Keys.downloadProcess(processId)
        const now = new Date().toISOString()

        const exists = yield* redis.use((client) => client.exists(key))
        if (!exists) {
          return yield* Effect.fail(new DownloadProcessNotFound({ processId }))
        }

        yield* redis.use((client) =>
          client.hset(key, {
            status: 'cancelled',
            lastUpdatedAt: now,
          }),
        )
        return 'OK'
      },
      Effect.retry(retryPolicy),
      Effect.catchTag('RedisError', (e) =>
        Effect.fail(
          new DownloadStateStoreUnavailable({ operation: 'cancelDownloadProcess', cause: e }),
        ),
      ),
      (effect, processId) => Effect.annotateLogs(effect, { processId }),
    )

  const deleteChunkState: DownloadStateRepository['Service']['deleteChunkState'] = Effect.fn(
    'DownloadStateRepository.deleteChunkState',
  )(
    function* (jobId) {
      const key = Keys.downloadState(jobId)
      return yield* redis.use((client) => client.del(key))
    },
    Effect.retry(retryPolicy),
    Effect.catchTag('RedisError', (e) =>
      Effect.fail(new DownloadStateStoreUnavailable({ operation: 'deleteChunkState', cause: e })),
    ),
    (effect, jobId) => Effect.annotateLogs(effect, { jobId }),
  )

  const deleteDownloadProcess: DownloadStateRepository['Service']['deleteDownloadProcess'] =
    Effect.fn('DownloadStateRepository.deleteDownloadProcess')(
      function* (processId) {
        const key = Keys.downloadProcess(processId)
        return yield* redis.use((client) => client.del(key))
      },
      Effect.retry(retryPolicy),
      Effect.catchTag('RedisError', (e) =>
        Effect.fail(
          new DownloadStateStoreUnavailable({ operation: 'deleteDownloadProcess', cause: e }),
        ),
      ),
      (effect, processId) => Effect.annotateLogs(effect, { processId }),
    )

  const isProcessActive: DownloadStateRepository['Service']['isProcessActive'] = Effect.fn(
    'DownloadStateRepository.isProcessActive',
  )(
    function* (processId) {
      const key = Keys.downloadProcess(processId)
      const status = yield* redis.use((client) => client.hget(key, 'status'))

      if (!status) {
        return false
      }

      return status === 'initializing' || status === 'processing'
    },
    Effect.retry(retryPolicy),
    Effect.catchTag('RedisError', (e) =>
      Effect.fail(new DownloadStateStoreUnavailable({ operation: 'isProcessActive', cause: e })),
    ),
    (effect, processId) => Effect.annotateLogs(effect, { processId }),
  )

  return DownloadStateRepository.of({
    saveChunkState,
    getChunkState,
    createDownloadProcess,
    getDownloadProcess,
    updateDownloadProcess,
    addJobToProcess,
    getProcessJobIds,
    atomicIncrementCompleted,
    atomicIncrementFailed,
    getActiveProcessForDomain,
    setActiveProcessForDomain,
    clearActiveProcessForDomain,
    cancelDownloadProcess,
    deleteChunkState,
    deleteDownloadProcess,
    isProcessActive,
  })
})

export const DownloadStateRepositoryLayerNoDeps = Layer.effect(
  DownloadStateRepository,
  makeDownloadStateRepository,
)

export const DownloadStateRepositoryLayer = DownloadStateRepositoryLayerNoDeps.pipe(
  Layer.provide(RedisClientLayer),
)
