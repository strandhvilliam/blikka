import { Cause, Chunk, Console, Data, Duration, Effect, Layer, Queue, Schedule, Schema, ServiceMap, Stream } from "effect"
import { RedisClient, RedisError } from "@blikka/redis"
import { PubSubChannel, PubSubMessage } from "./schema"
import { ChannelParseError, PubSubError } from "./utils"

export class PubSubService extends ServiceMap.Service<PubSubService>()(
  "@blikka/pubsub/pubsub-service",
  {
    make: Effect.gen(function* () {
      const redis = yield* RedisClient

      const publish = Effect.fn("PubSubService.publish")(
        function* (channel: PubSubChannel, message: PubSubMessage) {
          const channelString = yield* PubSubChannel.toString(channel)
          return yield* redis.use((client) => client.publish(channelString, message))
        },
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        ),
        Effect.mapError(
          (error) => new PubSubError({ cause: error, message: "Failed to publish message" })
        )
      )

      const subscribe = (channel: PubSubChannel) =>
        Stream.callback<PubSubMessage, ChannelParseError | PubSubError | RedisError>(
          Effect.fnUntraced(function* (queue) {
            const channelString = yield* PubSubChannel.toString(channel)

            const subscription = yield* Effect.acquireRelease(
              redis.use((client) => client.psubscribe<PubSubMessage>(channelString)),
              (subscription) =>
                Effect.tryPromise({
                  try: () => subscription.unsubscribe(),
                  catch: (error) =>
                    new RedisError({
                      cause: error,
                      message: "Failed to unsubscribe from channel",
                    }),
                }).pipe(
                  Effect.catch((error) =>
                    Effect.logError("Failed to unsubscribe from channel", error)
                  )
                )
            )

            subscription.on("pmessage", (data) => {
              if (data.message instanceof Error) {
                Console.error("Error in pmessage", data.message.message)
              }
              Queue.offerUnsafe(queue, data.message)
            })
            subscription.on("error", (error) =>
              Queue.failCauseUnsafe(
                queue,
                Cause.fail(
                  new PubSubError({ cause: error, message: "Failed to subscribe to channel" })
                )
              )
            )
          })
        )

      return {
        publish,
        subscribe,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(RedisClient.layer)
  )
}
