import { Cause, Console, Duration, Effect, Layer, Queue, Schedule, Context, Stream } from 'effect'
import { RedisClient, RedisClientLayer, RedisError } from '@blikka/redis'
import { PubSubChannel, PubSubMessage } from './schema'
import { ChannelParseError, PubSubError } from './errors'

export class PubSubService extends Context.Service<
  PubSubService,
  {
    /** Publish a message to a channel. */
    readonly publish: (
      channel: PubSubChannel,
      message: PubSubMessage,
    ) => Effect.Effect<number, PubSubError>
    /** Subscribe to a channel. */
    readonly subscribe: (
      channel: PubSubChannel,
    ) => Stream.Stream<PubSubMessage, ChannelParseError | PubSubError | RedisError>
  }
>()('@blikka/pubsub/pubsub-service') {}

const makePubSubService = Effect.gen(function* () {
  const redis = yield* RedisClient

  const publish = Effect.fn('PubSubService.publish')(
    function* (channel: PubSubChannel, message: PubSubMessage) {
      const channelString = yield* PubSubChannel.toString(channel)
      return yield* redis.use((client) => client.publish(channelString, message))
    },
    Effect.retry(Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))),
    Effect.mapError(
      (error) => new PubSubError({ cause: error, message: 'Failed to publish message' }),
    ),
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
                  message: 'Failed to unsubscribe from channel',
                }),
            }).pipe(
              Effect.catch((error) => Effect.logError('Failed to unsubscribe from channel', error)),
            ),
        )

        subscription.on('pmessage', (data) => {
          if (data.message instanceof Error) {
            Console.error('Error in pmessage', data.message.message)
          }
          Queue.offerUnsafe(queue, data.message)
        })
        subscription.on('error', (error) =>
          Queue.failCauseUnsafe(
            queue,
            Cause.fail(
              new PubSubError({ cause: error, message: 'Failed to subscribe to channel' }),
            ),
          ),
        )
      }),
    )

  return PubSubService.of({ publish, subscribe })
})

export const PubSubServiceLayerNoDeps = Layer.effect(PubSubService, makePubSubService)

export const PubSubServiceLayer = PubSubServiceLayerNoDeps.pipe(Layer.provide(RedisClientLayer))
