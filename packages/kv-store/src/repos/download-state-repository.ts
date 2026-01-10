import { Effect, Option, Schema, Schedule, Duration } from "effect"
import { RedisClient } from "@blikka/redis"
import { KeyFactory } from "../key-factory"
import {
  ChunkStateSchema,
  DownloadProcessStateSchema,
  type ChunkState,
  type DownloadProcessState,
} from "../schema"

export class DownloadStateRepository extends Effect.Service<DownloadStateRepository>()(
  "@blikka/packages/kv-store/download-state-repository",
  {
    dependencies: [RedisClient.Default, KeyFactory.Default],
    effect: Effect.gen(function* () {
      const redis = yield* RedisClient
      const keyFactory = yield* KeyFactory

      const getFilesToDownload = Effect.fn("DownloadStateRepository.getFilesToDownload")(
        function* (jobId: string) {
          const key = keyFactory.downloadStateFiles(jobId)
          const result = yield* redis.use((client) => client.get<string[] | null>(key))
          return result ?? []
        },
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const saveChunkState = Effect.fn("DownloadStateRepository.saveChunkState")(function* (
        jobId: string,
        state: ChunkState
      ) {
        const key = keyFactory.downloadState(jobId)
        const serialized = yield* Schema.encode(ChunkStateSchema)(state)
        return yield* redis.use((client) =>
          client.set(key, JSON.stringify(serialized), { ex: 3600 })
        )
      }, Effect.retry(
        Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
      ))

      const getChunkState = Effect.fn("DownloadStateRepository.getChunkState")(function* (
        jobId: string
      ) {
        const key = keyFactory.downloadState(jobId)
        const result = yield* redis.use((client) => client.get<string | null>(key))
        if (result === null) {
          return Option.none<ChunkState>()
        }
        const parsed = yield* Schema.decodeUnknown(ChunkStateSchema)(result)
        return Option.some(parsed)
      }, Effect.retry(
        Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
      ))

      const createDownloadProcess = Effect.fn("DownloadStateRepository.createDownloadProcess")(
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
          const key = keyFactory.downloadProcess(processId)
          const serialized = yield* Schema.encode(DownloadProcessStateSchema)(processState)
          return yield* redis.use((client) =>
            client.set(key, JSON.stringify(serialized), { ex: 86400 })
          )
        },
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const getDownloadProcess = Effect.fn("DownloadStateRepository.getDownloadProcess")(
        function* (processId: string) {
          const key = keyFactory.downloadProcess(processId)
          const result = yield* redis.use((client) => client.get<string | null>(key))
          if (result === null) {
            return Option.none<DownloadProcessState>()
          }
          const parsed = yield* Schema.decodeUnknown(DownloadProcessStateSchema)(result)
          return Option.some<DownloadProcessState>(parsed)
        },
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const updateDownloadProcess = Effect.fn("DownloadStateRepository.updateDownloadProcess")(
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

          const key = keyFactory.downloadProcess(processId)
          const serialized = yield* Schema.encode(DownloadProcessStateSchema)(updatedState)
          return yield* redis.use((client) =>
            client.set(key, JSON.stringify(serialized), { ex: 86400 })
          )
        },
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const addJobToProcess = Effect.fn("DownloadStateRepository.addJobToProcess")(function* (
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
      }, Effect.retry(
        Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
      ))

      const getProcessJobIds = Effect.fn("DownloadStateRepository.getProcessJobIds")(function* (
        processId: string
      ) {
        const processStateOption = yield* getDownloadProcess(processId)
        if (Option.isNone(processStateOption)) {
          return []
        }
        return processStateOption.value.jobIds
      }, Effect.retry(
        Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
      ))

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
