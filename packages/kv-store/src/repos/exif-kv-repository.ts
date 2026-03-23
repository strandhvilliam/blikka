import { Effect, Schema, Option, Schedule, Duration, ServiceMap, Layer } from "effect"
import { KeyFactory } from "../key-factory"
import { RedisClient } from "@blikka/redis"
import { ExifStateSchema, type ExifState } from "../schema"

export class ExifKVRepository extends ServiceMap.Service<ExifKVRepository>()(
  "@blikka/packages/kv-store/exif-kv-repository",
  {
    make: Effect.gen(function* () {
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
        const parsed = Schema.decodeUnknownOption(ExifStateSchema)(result)
        return parsed
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
          const decodeExifState = Schema.decodeUnknownOption(ExifStateSchema)

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
                orderIndex: Number(formattedOrderIndexes[index]) - 1,
                exif: parsed.value,
              },
            ]
          })
        },
        Effect.orElseSucceed(() =>
          [] as {
            orderIndex: number
            exif: { readonly [x: string]: unknown }
          }[]
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
) {
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(
      RedisClient.layer,
      KeyFactory.layer,
    ))
  )
}
