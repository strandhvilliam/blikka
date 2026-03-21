import { Duration, Effect, Layer, Option, Schedule, Schema, ServiceMap, Struct } from "effect"
import { RedisClient, RedisError } from "@blikka/redis"
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
import { luaIncrement } from "../lua-scripts/lua-increment"

function isMissingHashResult(result: Record<string, unknown> | null | undefined) {
  return !result || Object.keys(result).length === 0
}

export class UploadSessionRepository extends ServiceMap.Service<UploadSessionRepository>()(
  "@blikka/packages/kv-store/upload-session-repository",
  {
    make: Effect.gen(function* () {
      const redis = yield* RedisClient
      const keyFactory = yield* KeyFactory

      const initializeState = Effect.fn("UploadSessionRepository.initState")(
        function* (domain: string, reference: string, submissionKeys: string[]) {
          const map: Record<string, SubmissionState> = {}
          const submissionOrderIndexes: number[] = []

          for (const key of submissionKeys) {
            const { orderIndex } = yield* parseKey(key)
            submissionOrderIndexes.push(orderIndex)
            const formattedOrderIndex = (orderIndex + 1).toString().padStart(2, "0")
            const redisKey = keyFactory.submission(domain, reference, formattedOrderIndex)
            map[redisKey] = makeInitialSubmissionState(key, orderIndex)
          }

          const participantState = makeInitialParticipantState(
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
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
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
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const incrementParticipantState = Effect.fn(
        "UploadSessionRepository.incrementParticipantState"
      )(function* (domain: string, ref: string, orderIndex: number) {
        const key = keyFactory.participant(domain, ref)
        const incrementScript = luaIncrement
        const [result] = yield* redis
          .use((client) =>
            client.eval<string[], [string]>(incrementScript, [key], [orderIndex.toString()])
          )
          .pipe(
            Effect.mapError((error) => {
              return new RedisError({
                message: `[${domain}|${ref}|${orderIndex}] Failed to increment participant state: ${error.message}`,
                cause: error.cause,
              })
            })
          )
        const code = Schema.decodeUnknownSync(IncrementResultSchema)(result)

        switch (code) {
          case "INVALID_ORDER_INDEX":
            yield* setParticipantErrorState(domain, ref, code)
            return yield* new RedisError({
              message: `[${domain}|${ref}|${orderIndex}] Invalid order index provided: ${result}`,
              cause: result,
            })
            break
          case "MISSING_DATA":
            yield* setParticipantErrorState(domain, ref, code)
            return yield* new RedisError({
              message: `[${domain}|${ref}|${orderIndex}] Missing data provided: ${result}`,
              cause: result,
            })
            break
          case "DUPLICATE_ORDER_INDEX":
            yield* Effect.logWarning("Duplicate order index provided, skipping")
            break
          case "ALREADY_FINALIZED":
            yield* Effect.logWarning(`[${domain}|${ref}|${orderIndex}] Already finalized, skipping`)
            break
        }

        return { finalize: code === "FINALIZED" }
      })

      const getParticipantState = Effect.fn("UploadSessionRepository.getParticipantState")(
        function* (domain: string, ref: string) {
          const key = keyFactory.participant(domain, ref)
          const result = yield* redis.use((client) => client.hgetall(key))

          if (isMissingHashResult(result)) {
            return Option.none<ParticipantState>()
          }

          const parsed = Schema.decodeUnknownOption(ParticipantStateSchema)(result)
          return parsed
        }
      )

      const getSubmissionState = Effect.fn("UploadSessionRepository.getSubmissionState")(function* (
        domain: string,
        ref: string,
        orderIndex: number
      ) {
        const formattedOrderIndex = (Number(orderIndex) + 1).toString().padStart(2, "0")
        const key = keyFactory.submission(domain, ref, formattedOrderIndex)
        const result = yield* redis.use((client) => client.hgetall(key))
        if (isMissingHashResult(result)) {
          return Option.none<SubmissionState>()
        }
        const parsed = Schema.decodeUnknownOption(SubmissionStateSchema)(result)
        return parsed
      })

      const getAllSubmissionStates = Effect.fn("UploadSessionRepository.getAllSubmissionStates")(
        function* (domain: string, ref: string, orderIndexes: number[]) {
          const formattedOrderIndexes = orderIndexes.map((orderIndex) =>
            (Number(orderIndex) + 1).toString().padStart(2, "0")
          )
          const keys = formattedOrderIndexes.map((formattedOrderIndex) =>
            keyFactory.submission(domain, ref, formattedOrderIndex)
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
        }
      )

      const updateParticipantSession = Effect.fn(
        "UploadSessionRepository.updateParticipantSession"
      )(function* (domain: string, ref: string, state: Partial<ParticipantState>) {
        const key = keyFactory.participant(domain, ref)
        const encodedState = yield* Schema.encodeEffect(ParticipantStateSchema.mapFields(Struct.map(Schema.optional)))(state)
        return yield* redis.use((client) => client.hset(key, encodedState))
      })

      const updateSubmissionSession = Effect.fn("UploadSessionRepository.updateSubmissionSession")(
        function* (
          domain: string,
          ref: string,
          orderIndex: number,
          state: Partial<SubmissionState>
        ) {
          const formattedOrderIndex = (Number(orderIndex) + 1).toString().padStart(2, "0")
          const key = keyFactory.submission(domain, ref, formattedOrderIndex)
          const encodedState = yield* Schema.encodeEffect(SubmissionStateSchema.mapFields(Struct.map(Schema.optional)))(state)
          return yield* redis.use((client) => client.hset(key, encodedState))
        }
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
  }
) {
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(
      RedisClient.layer,
      KeyFactory.layer,
    ))
  )
}
