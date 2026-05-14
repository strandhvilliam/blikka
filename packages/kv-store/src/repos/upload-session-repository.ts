import { Context, Duration, Effect, Layer, Option, Schedule, Schema, Struct } from "effect"
import { RedisClient } from "@blikka/redis"
import { KeyFactory } from "../key-factory"
import {
  IncrementResultSchema,
  makeInitialParticipantState,
  makeInitialSubmissionState,
  ParticipantStateSchema,
  SubmissionStateSchema,
  type ParticipantState,
  type SubmissionState,
} from "../schema"
import { parseKey } from "../utils"
import { incrementParticipantScript } from "../lua-scripts/lua-increment"

function isMissingHashResult(result: Record<string, unknown> | null | undefined) {
  return !result || Object.keys(result).length === 0
}

export class UploadSessionRepositoryError extends Schema.TaggedErrorClass<UploadSessionRepositoryError>()(
  "UploadSessionRepositoryError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class UploadSessionRepository extends Context.Service<UploadSessionRepository>()(
  "@blikka/packages/kv-store/upload-session-repository",
  {
    make: Effect.gen(function* () {
      const redis = yield* RedisClient
      const keyFactory = yield* KeyFactory

      const initializeState = Effect.fn("UploadSessionRepository.initState")(
        function* (
          domain: string,
          reference: string,
          uploadSessionId: string,
          submissionKeys: readonly string[],
        ) {
          const map: Record<string, SubmissionState> = {}
          const submissionOrderIndexes: number[] = []

          for (const key of submissionKeys) {
            const { orderIndex } = yield* parseKey(key)
            submissionOrderIndexes.push(orderIndex)
            const formattedOrderIndex = (orderIndex + 1).toString().padStart(2, "0")
            const redisKey = keyFactory.submission(domain, reference, formattedOrderIndex)
            map[redisKey] = makeInitialSubmissionState(uploadSessionId, key, orderIndex)
          }

          const participantState = makeInitialParticipantState(
            uploadSessionId,
            submissionKeys.length,
            submissionOrderIndexes,
          )

          const existingParticipantState = yield* getParticipantState(domain, reference)
          const staleOrderIndexes = Option.match(existingParticipantState, {
            onSome: (state) => state.orderIndexes,
            onNone: () => [] as number[],
          })

          yield* redis.use((client) => {
            const participantKey = keyFactory.participant(domain, reference)
            const entries = Object.entries(map)
            const staleSubmissionKeys = staleOrderIndexes.map((orderIndex) =>
              keyFactory.submission(
                domain,
                reference,
                (orderIndex + 1).toString().padStart(2, "0"),
              ),
            )

            let multi = client.multi().del(participantKey)

            for (const staleSubmissionKey of staleSubmissionKeys) {
              multi = multi.del(staleSubmissionKey)
            }

            multi = multi.hset(participantKey, participantState)

            for (const [redisKey, value] of entries) {
              multi = multi.hset(redisKey, value)
            }

            return multi.exec()
          })
        },
        Effect.retry(Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))),
      )

      const setParticipantErrorState = Effect.fn("UploadSessionRepository.setErrorState")(
        function* (domain: string, ref: string, code: string) {
          const participantState = yield* getParticipantState(domain, ref)
          if (Option.isSome(participantState)) {
            yield* updateParticipantSession(domain, ref, {
              errors: [...participantState.value.errors, code],
            })
          }
        },
        Effect.retry(Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))),
      )

      const incrementParticipantState = Effect.fn(
        "UploadSessionRepository.incrementParticipantState",
      )(
        function* (domain: string, ref: string, orderIndex: number) {
          const key = keyFactory.participant(domain, ref)
          const result = yield* redis.use((client) =>
            incrementParticipantScript.run(client, {
              keys: { key },
              args: { orderIndex },
            }),
          )
          const status = Schema.decodeUnknownSync(IncrementResultSchema)(result)

          switch (status) {
            case "INVALID_ORDER_INDEX":
              yield* setParticipantErrorState(domain, ref, status)
              return yield* new UploadSessionRepositoryError({
                message: `[${domain}|${ref}|${orderIndex}] Invalid order index provided: ${result}`,
                cause: result,
              })
              break
            case "MISSING_DATA":
              yield* setParticipantErrorState(domain, ref, status)
              return yield* new UploadSessionRepositoryError({
                message: `[${domain}|${ref}|${orderIndex}] Missing data provided: ${result}`,
                cause: result,
              })
              break
            case "DUPLICATE_ORDER_INDEX":
              yield* Effect.logWarning("Duplicate order index provided, skipping")
              break
            case "ALREADY_FINALIZED":
              yield* Effect.logWarning(
                `[${domain}|${ref}|${orderIndex}] Already finalized, skipping`,
              )
              break
          }

          return { status }
        },
        Effect.mapError((error) => {
          return new UploadSessionRepositoryError({
            message: `Failed to increment participant state`,
            cause: error,
          })
        }),
      )

      const getParticipantState = Effect.fn("UploadSessionRepository.getParticipantState")(
        function* (domain: string, ref: string) {
          const key = keyFactory.participant(domain, ref)
          const result = yield* redis.use((client) => client.hgetall(key))

          if (isMissingHashResult(result)) {
            return Option.none<ParticipantState>()
          }

          const parsed = Schema.decodeUnknownOption(ParticipantStateSchema)(result)
          return parsed
        },
        Effect.mapError((error) => {
          return new UploadSessionRepositoryError({
            message: `Failed to get participant state`,
            cause: error,
          })
        }),
      )

      const getSubmissionState = Effect.fn("UploadSessionRepository.getSubmissionState")(
        function* (domain: string, ref: string, orderIndex: number) {
          const formattedOrderIndex = (Number(orderIndex) + 1).toString().padStart(2, "0")
          const key = keyFactory.submission(domain, ref, formattedOrderIndex)
          const result = yield* redis.use((client) => client.hgetall(key))
          if (isMissingHashResult(result)) {
            return Option.none<SubmissionState>()
          }
          const parsed = Schema.decodeUnknownOption(SubmissionStateSchema)(result)
          return parsed
        },
        Effect.mapError((error) => {
          return new UploadSessionRepositoryError({
            message: `Failed to get submission state`,
            cause: error,
          })
        }),
      )

      const getAllSubmissionStates = Effect.fn("UploadSessionRepository.getAllSubmissionStates")(
        function* (domain: string, ref: string, orderIndexes: number[]) {
          const formattedOrderIndexes = orderIndexes.map((orderIndex) =>
            (Number(orderIndex) + 1).toString().padStart(2, "0"),
          )
          const keys = formattedOrderIndexes.map((formattedOrderIndex) =>
            keyFactory.submission(domain, ref, formattedOrderIndex),
          )

          const result = yield* redis.use((client) => {
            const multi = keys.reduce((chain, redisKey) => chain.hgetall(redisKey), client.multi())
            return multi.exec<([string, Record<string, unknown>] | null)[]>()
          })

          return result.flatMap((entry) => {
            const hash = Array.isArray(entry) ? entry[1] : entry

            if (isMissingHashResult(hash)) {
              return []
            }

            const parsed = Schema.decodeUnknownOption(SubmissionStateSchema)(hash)

            return Option.match(parsed, {
              onSome: (state) => [state],
              onNone: () => [],
            })
          })
        },
        Effect.orElseSucceed(() => [] as SubmissionState[]),
      )

      const updateParticipantSession = Effect.fn(
        "UploadSessionRepository.updateParticipantSession",
      )(
        function* (domain: string, ref: string, state: Partial<ParticipantState>) {
          const key = keyFactory.participant(domain, ref)
          const encodedState = yield* Schema.encodeEffect(
            ParticipantStateSchema.mapFields(Struct.map(Schema.optional)),
          )(state)
          return yield* redis.use((client) => client.hset(key, encodedState))
        },
        Effect.retry(Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))),
        Effect.mapError((error) => {
          return new UploadSessionRepositoryError({
            message: `Failed to update participant session`,
            cause: error,
          })
        }),
      )

      const updateSubmissionSession = Effect.fn("UploadSessionRepository.updateSubmissionSession")(
        function* (
          domain: string,
          ref: string,
          orderIndex: number,
          state: Partial<SubmissionState>,
        ) {
          const formattedOrderIndex = (Number(orderIndex) + 1).toString().padStart(2, "0")
          const key = keyFactory.submission(domain, ref, formattedOrderIndex)
          const encodedState = yield* Schema.encodeEffect(
            SubmissionStateSchema.mapFields(Struct.map(Schema.optional)),
          )(state)
          return yield* redis.use((client) => client.hset(key, encodedState))
        },
        Effect.mapError((error) => {
          return new UploadSessionRepositoryError({
            message: `Failed to update submission session`,
            cause: error,
          })
        }),
      )

      return {
        getParticipantState,
        getSubmissionState,
        getAllSubmissionStates,
        initializeState,
        incrementParticipantState,
        setParticipantErrorState,
        updateParticipantSession,
        updateSubmissionSession,
      } as const
    }),
  },
) {
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(RedisClient.layer, KeyFactory.layer)),
  )
}
