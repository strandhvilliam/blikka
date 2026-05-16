import { Context, Effect, Layer, Option, Schema } from "effect"
import { RedisClient, RedisClientLayer } from "@blikka/redis"
import { Keys } from "./key-factory"

export class ExifKVRepositoryError extends Schema.TaggedErrorClass<ExifKVRepositoryError>()(
  "ExifKVRepositoryError",
  {
    operation: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const ExifStateSchema = Schema.Record(Schema.String, Schema.Unknown)

export type ExifState = typeof ExifStateSchema.Type

export class ExifKVRepository extends Context.Service<
  ExifKVRepository,
  {
    /**
     * Get the EXIF state from KV for a given domain, reference, and order index.
     */
    readonly getExifState: (
      domain: string,
      ref: string,
      orderIndex: number,
    ) => Effect.Effect<Option.Option<ExifState>, ExifKVRepositoryError>

    /**
     * Get all EXIF states from KV for a given domain, reference, and order indexes.
     */
    readonly getAllExifStates: (
      domain: string,
      ref: string,
      orderIndexes: Array<number>,
    ) => Effect.Effect<Array<{ readonly orderIndex: number; readonly exif: ExifState }>, never>

    /**
     * Set the EXIF state in KV for a given domain, reference, and order index.
     */
    readonly setExifState: (
      domain: string,
      ref: string,
      orderIndex: number,
      state: ExifState,
    ) => Effect.Effect<string | null, ExifKVRepositoryError>

    /**
     * Delete EXIF states from KV for a given domain, reference, and order indexes.
     */
    readonly deleteExifStates: (
      domain: string,
      ref: string,
      orderIndexes: ReadonlyArray<number>,
    ) => Effect.Effect<number, ExifKVRepositoryError>
  }
>()("@blikka/packages/kv-store/exif-kv-repository") {}

const makeExifKVRepository = Effect.gen(function* () {
  const redis = yield* RedisClient

  const getExifState: ExifKVRepository["Service"]["getExifState"] = Effect.fn(
    "ExifKVRepository.getExifState",
  )(
    function* (domain, ref, orderIndex) {
      const key = Keys.exif(domain, ref, orderIndex)
      const result = yield* redis
        .use((client) => client.get<string | null>(key))
        .pipe(
          Effect.catchTag("RedisError", (e) =>
            Effect.fail(new ExifKVRepositoryError({ operation: "getExifState", cause: e })),
          ),
        )

      if (result === null) {
        return Option.none<ExifState>()
      }

      return Schema.decodeUnknownOption(ExifStateSchema)(result)
    },
    (effect, domain, ref, orderIndex) =>
      Effect.annotateLogs(effect, { domain, reference: ref, orderIndex }),
  )

  const getAllExifStates: ExifKVRepository["Service"]["getAllExifStates"] = Effect.fn(
    "ExifKVRepository.getAllExifStates",
  )(
    function* (domain, ref, orderIndexes) {
      const keys = orderIndexes.map((orderIndex) => Keys.exif(domain, ref, orderIndex))
      const decodeExifState = Schema.decodeUnknownOption(ExifStateSchema)
      const data = yield* redis
        .use((client) => client.mget(keys))
        .pipe(Effect.orElseSucceed(() => [] as Array<string | null>))

      return data.flatMap((item, index) => {
        if (item === null) {
          return []
        }

        const parsed = decodeExifState(item)
        if (Option.isNone(parsed)) {
          return []
        }

        return [
          {
            orderIndex: orderIndexes[index]!,
            exif: parsed.value,
          },
        ]
      })
    },
    (effect, domain, ref, orderIndexes) =>
      Effect.annotateLogs(effect, {
        domain,
        reference: ref,
        exifCount: orderIndexes.length,
      }),
  )

  const setExifState: ExifKVRepository["Service"]["setExifState"] = Effect.fn(
    "ExifKVRepository.setExifState",
  )(
    function* (domain, ref, orderIndex, state) {
      const key = Keys.exif(domain, ref, orderIndex)
      return yield* redis
        .use((client) => client.set(key, JSON.stringify(state)))
        .pipe(
          Effect.catchTag("RedisError", (e) =>
            Effect.fail(new ExifKVRepositoryError({ operation: "setExifState", cause: e })),
          ),
        )
    },
    (effect, domain, ref, orderIndex, _state) =>
      Effect.annotateLogs(effect, { domain, reference: ref, orderIndex }),
  )

  const deleteExifStates: ExifKVRepository["Service"]["deleteExifStates"] = Effect.fn(
    "ExifKVRepository.deleteExifStates",
  )(
    function* (domain, ref, orderIndexes) {
      if (orderIndexes.length === 0) {
        return 0
      }

      const keys = Array.from(
        new Set(orderIndexes.map((orderIndex) => Keys.exif(domain, ref, orderIndex))),
      )

      return yield* redis
        .use((client) => client.del(...keys))
        .pipe(
          Effect.catchTag("RedisError", (e) =>
            Effect.fail(new ExifKVRepositoryError({ operation: "deleteExifStates", cause: e })),
          ),
        )
    },
    (effect, domain, ref, orderIndexes) =>
      Effect.annotateLogs(effect, {
        domain,
        reference: ref,
        exifCount: orderIndexes.length,
      }),
  )

  return ExifKVRepository.of({
    getExifState,
    getAllExifStates,
    setExifState,
    deleteExifStates,
  })
})

export const ExifKVRepositoryLayerNoDeps = Layer.effect(ExifKVRepository, makeExifKVRepository)

export const ExifKVRepositoryLayer = ExifKVRepositoryLayerNoDeps.pipe(
  Layer.provide(RedisClientLayer),
)
