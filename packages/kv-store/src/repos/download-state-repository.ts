import { Effect, Option, Schedule, Duration, Schema, ServiceMap, Layer } from "effect"
import { RedisClient } from "@blikka/redis"
import { KeyFactory } from "../key-factory"
import { atomicIncrementCompletedScript } from "../lua-scripts/atomic-increment-completed-script"
import { atomicIncrementFailedScript } from "../lua-scripts/atomic-increment-failed-script"
import { atomicAddJobScript } from "../lua-scripts/atomic-add-job-script"
import {
  ChunkStateSchema,
  DownloadProcessStateSchema,
  DownloadProcessStatusSchema,
  StringArrayFromString,
  type ChunkState,
  type DownloadProcessState,
  type DownloadProcessStatus,
} from "../schema"

const CHUNK_TTL_SECONDS = 21600
const PROCESS_TTL_SECONDS = 172800
const ACTIVE_PROCESS_TTL_SECONDS = 172800

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

export class DownloadStateRepository extends ServiceMap.Service<DownloadStateRepository>()(
  "@blikka/packages/kv-store/download-state-repository",
  {
    make: Effect.gen(function* () {
      const redis = yield* RedisClient
      const keyFactory = yield* KeyFactory

      const retryPolicy = Schedule.compose(
        Schedule.exponential(Duration.millis(100)),
        Schedule.recurs(3)
      )

      // --- Chunk State (using HASH) ---

      const saveChunkState = Effect.fn("DownloadStateRepository.saveChunkState")(function* (
        jobId: string,
        state: ChunkState
      ) {
        const key = keyFactory.downloadState(jobId)
        yield* redis.use((client) => client.hset(key, state))
        yield* redis.use((client) => client.expire(key, CHUNK_TTL_SECONDS))
        return "OK"
      }, Effect.retry(retryPolicy))

      const getChunkState = Effect.fn("DownloadStateRepository.getChunkState")(function* (
        jobId: string
      ) {
        yield* Effect.logInfo({
          message: "Getting chunk state",
          jobId,
        })
        const key = keyFactory.downloadState(jobId)
        const result = yield* redis.use((client) => client.hgetall(key))

        yield* Effect.logInfo({
          message: "Result",
          result,
        })

        if (!result || Object.keys(result).length === 0) {
          return Option.none<ChunkState>()
        }

        return Schema.decodeUnknownOption(ChunkStateSchema)(result)
      }, Effect.retry(retryPolicy))

      // --- Download Process State (using HASH) ---

      const createDownloadProcess = Effect.fn("DownloadStateRepository.createDownloadProcess")(
        function* (processId: string, domain: string, totalChunks: number) {
          const now = new Date().toISOString()
          const key = keyFactory.downloadProcess(processId)

          const initialState: DownloadProcessState = {
            processId,
            domain,
            createdAt: now,
            lastUpdatedAt: now,
            status: "initializing",
            totalChunks,
            completedChunks: 0,
            failedChunks: 0,
            jobIds: [],
            failedJobIds: [],
            competitionClasses: [],
          }

          yield* redis.use((client) => client.hset(key, initialState))
          yield* redis.use((client) => client.expire(key, PROCESS_TTL_SECONDS))

          return "OK"
        },
        Effect.retry(retryPolicy)
      )

      const getDownloadProcess = Effect.fn("DownloadStateRepository.getDownloadProcess")(function* (
        processId: string
      ) {
        const key = keyFactory.downloadProcess(processId)
        const result = yield* redis.use((client) => client.hgetall(key))

        if (!result || Object.keys(result).length === 0) {
          return Option.none<DownloadProcessState>()
        }

        return Schema.decodeUnknownOption(DownloadProcessStateSchema)(result)
      }, Effect.retry(retryPolicy))

      const updateDownloadProcess = Effect.fn("DownloadStateRepository.updateDownloadProcess")(
        function* (
          processId: string,
          updates: Partial<Omit<DownloadProcessState, "processId" | "domain" | "createdAt">>
        ) {

          yield* Effect.logInfo({
            message: "Updating download process",
            processId,
            updates,
          })

          const key = keyFactory.downloadProcess(processId)

          const exists = yield* redis.use((client) => client.exists(key))
          if (!exists) {
            return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
          }

          const currentStateOption = yield* getDownloadProcess(processId)
          if (Option.isNone(currentStateOption)) {
            return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
          }

          const currentState = currentStateOption.value
          yield* Effect.logInfo({
            message: "Current state",
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
          return "OK"
        },
        Effect.retry(retryPolicy)
      )

      /**
       * Atomically increment completedChunks and update status if all chunks processed.
       * This is safe to call concurrently from multiple ECS tasks.
       */
      const atomicIncrementCompleted = Effect.fn(
        "DownloadStateRepository.atomicIncrementCompleted"
      )(function* (processId: string, totalChunks: number) {
        const key = keyFactory.downloadProcess(processId)
        const now = new Date().toISOString()

        const result = yield* Effect.tryPromise({
          try: () =>
            atomicIncrementCompletedScript.run(redis.client, {
              keys: { key },
              args: { totalChunks, now, ttl: PROCESS_TTL_SECONDS },
            }),
          catch: (error) =>
            new Error(`Failed to increment completed chunks: ${error instanceof Error ? error.message : String(error)}`),
        })

        if (result === null) {
          return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
        }

        // Parse JSON string returned from Lua script
        const parsed = Schema.decodeUnknownSync(AtomicIncrementResultSchema)(
          typeof result === "string" ? JSON.parse(result) : result
        )
        return parsed as AtomicIncrementResult
      }, Effect.retry(retryPolicy))

      /**
       * Atomically increment failedChunks and update status if all chunks processed.
       * This is safe to call concurrently from multiple ECS tasks.
       */
      const atomicIncrementFailed = Effect.fn("DownloadStateRepository.atomicIncrementFailed")(
        function* (processId: string, totalChunks: number, failedJobId: string) {
          const key = keyFactory.downloadProcess(processId)
          const now = new Date().toISOString()

          const result = yield* Effect.tryPromise({
            try: () =>
              atomicIncrementFailedScript.run(redis.client, {
                keys: { key },
                args: { totalChunks, now, failedJobId, ttl: PROCESS_TTL_SECONDS },
              }),
            catch: (error) =>
              new Error(`Failed to increment failed chunks: ${error instanceof Error ? error.message : String(error)}`),
          })

          if (result === null) {
            return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
          }

          const parsed = Schema.decodeUnknownSync(AtomicIncrementResultSchema)(
            typeof result === "string" ? JSON.parse(result) : result
          )
          return parsed as AtomicIncrementResult
        },
        Effect.retry(retryPolicy)
      )

      /**
       * Atomically add a job ID to the process using Lua script.
       * This is safe to call concurrently.
       */
      const addJobToProcess = Effect.fn("DownloadStateRepository.addJobToProcess")(function* (
        processId: string,
        jobId: string
      ) {
        const key = keyFactory.downloadProcess(processId)
        const now = new Date().toISOString()

        const result = yield* Effect.tryPromise({
          try: () =>
            atomicAddJobScript.run(redis.client, {
              keys: { key },
              args: { jobId, now, ttl: PROCESS_TTL_SECONDS },
            }),
          catch: (error) =>
            new Error(`Failed to add job to process: ${error instanceof Error ? error.message : String(error)}`),
        })

        if (result === null) {
          return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
        }

        return result as string
      }, Effect.retry(retryPolicy))

      const getProcessJobIds = Effect.fn("DownloadStateRepository.getProcessJobIds")(function* (
        processId: string
      ) {
        const key = keyFactory.downloadProcess(processId)
        const result = yield* redis.use((client) => client.hget<string>(key, "jobIds"))
        if (!result || result === "") {
          return []
        }
        // Decode comma-separated string to array
        return decodeStringArray(result)
      }, Effect.retry(retryPolicy))

      // --- Active Process Tracking per Domain ---

      const getActiveProcessForDomain = Effect.fn(
        "DownloadStateRepository.getActiveProcessForDomain"
      )(function* (domain: string) {
        const key = keyFactory.activeDownloadProcess(domain)
        const result = yield* redis.use((client) => client.get<string | null>(key))
        return Option.fromNullishOr(result)
      }, Effect.retry(retryPolicy))

      const setActiveProcessForDomain = Effect.fn(
        "DownloadStateRepository.setActiveProcessForDomain"
      )(function* (domain: string, processId: string) {
        const key = keyFactory.activeDownloadProcess(domain)
        return yield* redis.use((client) =>
          client.set(key, processId, { ex: ACTIVE_PROCESS_TTL_SECONDS })
        )
      }, Effect.retry(retryPolicy))

      const clearActiveProcessForDomain = Effect.fn(
        "DownloadStateRepository.clearActiveProcessForDomain"
      )(function* (domain: string) {
        const key = keyFactory.activeDownloadProcess(domain)
        return yield* redis.use((client) => client.del(key))
      }, Effect.retry(retryPolicy))

      /**
       * Cancel a download process by setting its status to 'cancelled'.
       * ECS tasks should check the status before processing.
       */
      const cancelDownloadProcess = Effect.fn("DownloadStateRepository.cancelDownloadProcess")(
        function* (processId: string) {
          const key = keyFactory.downloadProcess(processId)
          const now = new Date().toISOString()

          const exists = yield* redis.use((client) => client.exists(key))
          if (!exists) {
            return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
          }

          yield* redis.use((client) =>
            client.hset(key, {
              status: "cancelled",
              lastUpdatedAt: now,
            })
          )
          return "OK"
        },
        Effect.retry(retryPolicy)
      )

      /**
       * Check if the process is still active (not cancelled or failed).
       * ECS tasks should call this before starting work.
       */
      const isProcessActive = Effect.fn("DownloadStateRepository.isProcessActive")(function* (
        processId: string
      ) {
        const key = keyFactory.downloadProcess(processId)
        const status = yield* redis.use((client) => client.hget(key, "status"))

        if (!status) {
          return false
        }

        return status === "initializing" || status === "processing"
      }, Effect.retry(retryPolicy))

      return {
        saveChunkState,
        getChunkState,
        createDownloadProcess,
        getDownloadProcess,
        updateDownloadProcess,
        addJobToProcess,
        getProcessJobIds,
        // Atomic operations for concurrent task updates
        atomicIncrementCompleted,
        atomicIncrementFailed,
        // Active process tracking per domain
        getActiveProcessForDomain,
        setActiveProcessForDomain,
        clearActiveProcessForDomain,
        // Cancellation
        cancelDownloadProcess,
        isProcessActive,
      } as const
    }),
  }
) {
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(
      RedisClient.layer,
      KeyFactory.layer,
    ))
  )
}
