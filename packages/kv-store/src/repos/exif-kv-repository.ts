import { Effect, Schema, Option, Schedule, Duration } from "effect"
import { KeyFactory } from "../key-factory"
import { RedisClient } from "@blikka/redis"
import { NodeFileSystem } from "@effect/platform-node"
import { ExifStateSchema, type ExifState } from "../schema"

export class ExifKVRepository extends Effect.Service<ExifKVRepository>()(
  "@blikka/packages/kv-store/exif-kv-repository",
  {
    dependencies: [KeyFactory.Default, RedisClient.Default],
    effect: Effect.gen(function* () {
      const redis = yield* RedisClient
      const keyFactory = yield* KeyFactory

      const getExifState = Effect.fn("ExifKVRepository.getExifState")(function* (
        domain: string,
        ref: string,
        orderIndex: string
      ) {
        const key = keyFactory.exif(domain, ref, orderIndex)
        const result = yield* redis.use((client) => client.get<string | null>(key))
        if (result === null) {
          return Option.none<ExifState>()
        }
        const parsed = yield* Schema.decodeUnknown(ExifStateSchema)(result)
        return Option.some<ExifState>(parsed)
      })

      const getAllExifStates = Effect.fn("ExifKVRepository.getAllExifStates")(
        function* (domain: string, ref: string, orderIndexes: number[]) {
          const formattedOrderIndexes = orderIndexes.map((orderIndex) =>
            (Number(orderIndex) + 1).toString().padStart(2, "0")
          )
          const keys = formattedOrderIndexes.map((formattedOrderIndex) =>
            keyFactory.exif(domain, ref, formattedOrderIndex)
          )
          const data = yield* redis.use((client) => client.mget(keys))
          const parsed = yield* Schema.decodeUnknown(Schema.Array(ExifStateSchema))(data)

          const result = formattedOrderIndexes.map((formattedOrderIndex, index) => {
            return {
              orderIndex: Number(formattedOrderIndex) - 1,
              exif: parsed.at(index) ?? {},
            }
          })

          return result
        },
        Effect.orElse(() =>
          Effect.succeed(
            [] as {
              orderIndex: number
              exif: { readonly [x: string]: unknown }
            }[]
          )
        )
      )

      const setExifState = Effect.fn("ExifKVRepository.setExifState")(function* (
        domain: string,
        ref: string,
        orderIndex: number,
        state: ExifState
      ) {
        const formattedOrderIndex = (Number(orderIndex) + 1).toString().padStart(2, "0")
        const key = keyFactory.exif(domain, ref, formattedOrderIndex)
        return yield* redis.use((client) => client.set(key, JSON.stringify(state)))
      })

      return {
        getExifState,
        setExifState,
        getAllExifStates,
      }
    }),
  }
) {}
