import { Effect, Option, Schema } from "effect"
import { RedisClient } from "@blikka/redis"

export const ChunkStateSchema = Schema.Struct({
  processId: Schema.String,
  domain: Schema.String,
  competitionClassId: Schema.Number,
  competitionClassName: Schema.String,
  minReference: Schema.String,
  maxReference: Schema.String,
  zipKey: Schema.String,
  chunkIndex: Schema.Number,
  totalChunks: Schema.Number,
})

export type ChunkState = Schema.Schema.Type<typeof ChunkStateSchema>

export const DownloadProcessStatusSchema = Schema.Literal(
  "initializing",
  "processing",
  "completed",
  "failed",
  "cancelled"
)

export type DownloadProcessStatus = Schema.Schema.Type<typeof DownloadProcessStatusSchema>

export const DownloadProcessStateSchema = Schema.Struct({
  processId: Schema.String,
  domain: Schema.String,
  createdAt: Schema.String,
  status: DownloadProcessStatusSchema,
  totalChunks: Schema.Number,
  completedChunks: Schema.Number,
  failedChunks: Schema.Number,
  jobIds: Schema.Array(Schema.String),
  competitionClasses: Schema.Array(
    Schema.Struct({
      competitionClassId: Schema.Number,
      competitionClassName: Schema.String,
      totalChunks: Schema.Number,
    })
  ),
})

export type DownloadProcessState = Schema.Schema.Type<typeof DownloadProcessStateSchema>

export class DownloadStateManager extends Effect.Service<DownloadStateManager>()(
  "@blikka/tasks/zip-downloader/DownloadStateManager",
  {
    dependencies: [RedisClient.Default],
    effect: Effect.gen(function* () {
      const redis = yield* RedisClient

      const getFilesToDownload = Effect.fn("DownloadStateManager.getFilesToDownload")(function* (
        jobId: string
      ) {
        const key = `download-state:${jobId}:files`
        const result = yield* redis.use((client) => client.get<string[] | null>(key))
        return result ?? []
      })

      const saveChunkState = Effect.fn("DownloadStateManager.saveChunkState")(function* (
        jobId: string,
        state: ChunkState
      ) {
        const key = `download-state:${jobId}`
        const serialized = yield* Schema.encode(ChunkStateSchema)(state)
        return yield* redis.use((client) =>
          client.set(key, JSON.stringify(serialized), { ex: 3600 })
        )
      })

      const getChunkState = Effect.fn("DownloadStateManager.getChunkState")(function* (
        jobId: string
      ) {
        const key = `download-state:${jobId}`
        const result = yield* redis.use((client) => client.get<string | null>(key))
        if (result === null) {
          return Option.none<ChunkState>()
        }
        const parsed = yield* Schema.decodeUnknown(ChunkStateSchema)(result)
        return Option.some(parsed)
      })

      const createDownloadProcess = Effect.fn("DownloadStateManager.createDownloadProcess")(
        function* (processId: string, domain: string, totalChunks: number) {
          const processState: DownloadProcessState = {
            processId,
            domain,
            createdAt: new Date().toISOString(),
            status: "initializing",
            totalChunks,
            completedChunks: 0,
            failedChunks: 0,
            jobIds: [],
            competitionClasses: [],
          }
          const key = `download-process:${processId}`
          const serialized = yield* Schema.encode(DownloadProcessStateSchema)(processState)
          return yield* redis.use((client) =>
            client.set(key, JSON.stringify(serialized), { ex: 86400 })
          )
        }
      )

      const getDownloadProcess = Effect.fn("DownloadStateManager.getDownloadProcess")(function* (
        processId: string
      ) {
        const key = `download-process:${processId}`
        const result = yield* redis.use((client) => client.get<string | null>(key))
        if (result === null) {
          return Option.none<DownloadProcessState>()
        }
        const parsed = yield* Schema.decodeUnknown(DownloadProcessStateSchema)(result)
        console.log("parsed", parsed)
        return Option.some(parsed)
      })

      const updateDownloadProcess = Effect.fn("DownloadStateManager.updateDownloadProcess")(
        function* (
          processId: string,
          updates: Partial<Omit<DownloadProcessState, "processId" | "domain" | "createdAt">>
        ) {
          const processStateOption = yield* getDownloadProcess(processId)
          if (Option.isNone(processStateOption)) {
            return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
          }

          const currentState = processStateOption.value
          const updatedState: DownloadProcessState = {
            ...currentState,
            ...updates,
            // Ensure jobIds array is properly merged if provided
            jobIds: updates.jobIds ?? currentState.jobIds,
            // Ensure competitionClasses array is properly merged if provided
            competitionClasses: updates.competitionClasses ?? currentState.competitionClasses,
          }

          const key = `download-process:${processId}`
          const serialized = yield* Schema.encode(DownloadProcessStateSchema)(updatedState)
          return yield* redis.use((client) =>
            client.set(key, JSON.stringify(serialized), { ex: 86400 })
          )
        }
      )

      const addJobToProcess = Effect.fn("DownloadStateManager.addJobToProcess")(function* (
        processId: string,
        jobId: string
      ) {
        const processStateOption = yield* getDownloadProcess(processId)
        if (Option.isNone(processStateOption)) {
          return yield* Effect.fail(new Error(`Download process not found: ${processId}`))
        }

        const currentState = processStateOption.value
        const updatedJobIds = [...currentState.jobIds, jobId]

        return yield* updateDownloadProcess(processId, {
          jobIds: updatedJobIds,
          status: currentState.status === "initializing" ? "processing" : currentState.status,
        })
      })

      const getProcessJobIds = Effect.fn("DownloadStateManager.getProcessJobIds")(function* (
        processId: string
      ) {
        const processStateOption = yield* getDownloadProcess(processId)
        if (Option.isNone(processStateOption)) {
          return []
        }
        return processStateOption.value.jobIds
      })

      return {
        getFilesToDownload,
        saveChunkState,
        getChunkState,
        createDownloadProcess,
        getDownloadProcess,
        updateDownloadProcess,
        addJobToProcess,
        getProcessJobIds,
      } as const
    }),
  }
) {}
