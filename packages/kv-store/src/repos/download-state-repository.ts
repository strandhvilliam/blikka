import { Effect, Option, Schedule, Duration, Schema } from "effect"
import { RedisClient } from "@blikka/redis"
import { KeyFactory } from "../key-factory"
import {
  ChunkStateSchema,
  DownloadProcessStateSchema,
  StringArrayFromString,
  type ChunkState,
  type DownloadProcessState,
  type DownloadProcessStatus,
} from "../schema"

// TTL constants
const CHUNK_TTL_SECONDS = 21600 // 6 hours
const PROCESS_TTL_SECONDS = 172800 // 48 hours
const ACTIVE_PROCESS_TTL_SECONDS = 172800 // 48 hours

// Lua script for atomic increment of completedChunks with status check using HASH
const ATOMIC_INCREMENT_COMPLETED_SCRIPT = `
local key = KEYS[1]
local totalChunks = tonumber(ARGV[1])
local now = ARGV[2]

-- Check if hash exists
if redis.call('EXISTS', key) == 0 then
  return nil
end

-- Atomically increment completedChunks
local newCompletedChunks = redis.call('HINCRBY', key, 'completedChunks', 1)
redis.call('HSET', key, 'lastUpdatedAt', now)

-- Get current failedChunks
local failedChunks = tonumber(redis.call('HGET', key, 'failedChunks') or '0')

-- Check if all chunks are now processed
local processedChunks = newCompletedChunks + failedChunks
local status = redis.call('HGET', key, 'status')

if processedChunks >= totalChunks then
  if failedChunks > 0 then
    status = 'failed'
  else
    status = 'completed'
  end
  redis.call('HSET', key, 'status', status)
end

-- Refresh TTL
redis.call('EXPIRE', key, ${PROCESS_TTL_SECONDS})

return cjson.encode({
  completedChunks = newCompletedChunks,
  failedChunks = failedChunks,
  status = status
})
`

// Lua script for atomic increment of failedChunks with status check using HASH
const ATOMIC_INCREMENT_FAILED_SCRIPT = `
local key = KEYS[1]
local totalChunks = tonumber(ARGV[1])
local now = ARGV[2]
local failedJobId = ARGV[3]

-- Check if hash exists
if redis.call('EXISTS', key) == 0 then
  return nil
end

-- Atomically increment failedChunks
local newFailedChunks = redis.call('HINCRBY', key, 'failedChunks', 1)
redis.call('HSET', key, 'lastUpdatedAt', now)

-- Append failedJobId to the list (stored as comma-separated string)
local currentFailedJobIds = redis.call('HGET', key, 'failedJobIds') or ''
if currentFailedJobIds == '' then
  redis.call('HSET', key, 'failedJobIds', failedJobId)
else
  redis.call('HSET', key, 'failedJobIds', currentFailedJobIds .. ',' .. failedJobId)
end

-- Get current completedChunks
local completedChunks = tonumber(redis.call('HGET', key, 'completedChunks') or '0')

-- Check if all chunks are now processed
local processedChunks = completedChunks + newFailedChunks
local status = redis.call('HGET', key, 'status')

if processedChunks >= totalChunks then
  status = 'failed'
  redis.call('HSET', key, 'status', status)
end

-- Refresh TTL
redis.call('EXPIRE', key, ${PROCESS_TTL_SECONDS})

return cjson.encode({
  completedChunks = completedChunks,
  failedChunks = newFailedChunks,
  status = status
})
`

// Lua script for atomic job addition using HASH
const ATOMIC_ADD_JOB_SCRIPT = `
local key = KEYS[1]
local jobId = ARGV[1]
local now = ARGV[2]

-- Check if hash exists
if redis.call('EXISTS', key) == 0 then
  return nil
end

-- Get current jobIds (expecting a JSON array string like "[]" or "["id1"]")
local currentJobIds = redis.call('HGET', key, 'jobIds') or '[]'

local newJobIds
if currentJobIds == '[]' or currentJobIds == '' then
  -- Create new array with the single jobId
  newJobIds = '["' .. jobId .. '"]'
else
  -- Remove the trailing ']' and append the new jobId
  newJobIds = string.sub(currentJobIds, 1, -2) .. ',"' .. jobId .. '"]'
end

redis.call('HSET', key, 'jobIds', newJobIds)
redis.call('HSET', key, 'lastUpdatedAt', now)

-- Update status from initializing to processing if needed
local status = redis.call('HGET', key, 'status')
if status == 'initializing' then
  redis.call('HSET', key, 'status', 'processing')
  status = 'processing'
end

-- Refresh TTL
redis.call('EXPIRE', key, ${PROCESS_TTL_SECONDS})

return status
`

interface AtomicIncrementResult {
  completedChunks: number
  failedChunks: number
  status: DownloadProcessStatus
}

// Schema encode/decode helpers using Effect's built-in functions
// const encodeChunkState = Schema.encodeSync(ChunkStateRedisSchema)
// const decodeChunkState = Schema.decodeUnknown(ChunkStateRedisSchema)

// const encodeDownloadProcessState = Schema.encodeSync(DownloadProcessStateRedisSchema)
// const decodeDownloadProcessState = Schema.decodeUnknown(DownloadProcessStateRedisSchema)

const decodeStringArray = Schema.decodeSync(StringArrayFromString)

export class DownloadStateRepository extends Effect.Service<DownloadStateRepository>()(
  "@blikka/packages/kv-store/download-state-repository",
  {
    dependencies: [RedisClient.Default, KeyFactory.Default],
    effect: Effect.gen(function* () {
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

        const state = yield* Schema.decodeUnknown(ChunkStateSchema)(result)
        return Option.some(state)
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

        const state = yield* Schema.decodeUnknown(DownloadProcessStateSchema)(result)
        return Option.some(state)
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

        const result = yield* redis.use((client) =>
          client.eval(ATOMIC_INCREMENT_COMPLETED_SCRIPT, [key], [totalChunks.toString(), now])
        )

        if (result === null) {
          return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
        }

        const parsed =
          typeof result === "string" ? JSON.parse(result) : (result as AtomicIncrementResult)
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

          const result = yield* redis.use((client) =>
            client.eval(
              ATOMIC_INCREMENT_FAILED_SCRIPT,
              [key],
              [totalChunks.toString(), now, failedJobId]
            )
          )

          if (result === null) {
            return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
          }

          const parsed =
            typeof result === "string" ? JSON.parse(result) : (result as AtomicIncrementResult)
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

        const result = yield* redis.use((client) =>
          client.eval(ATOMIC_ADD_JOB_SCRIPT, [key], [jobId, now])
        )

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
        return Option.fromNullable(result)
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
) {}
