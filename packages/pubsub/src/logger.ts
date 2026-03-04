import { Effect, Layer, Logger, ServiceMap } from "effect"
import { PubSubService } from "./pubsub-service"
import { PubSubChannel, PubSubMessage } from "./schema"

export const makePubSubLogger = (taskName: string) =>
  Logger.layer([
    Effect.gen(function* () {
      const pubsub = yield* PubSubService

      return Logger.make(({ logLevel, message }) => {
        const timestamp = new Date().toISOString()
        const logMessage = `[${timestamp}] ${logLevel}: ${message}`

        Effect.runFork(
          Effect.gen(function* () {
            const channel = yield* PubSubChannel.fromString(`dev:logger:${taskName}`)
            const msg = yield* PubSubMessage.create(channel, logMessage)
            return yield* pubsub.publish(channel, msg)
          }).pipe(
            Effect.catch((error) => {
              return Effect.logError("Failed to publish log message", error)
            })
          )
        )
      })
    })
  ], { mergeWithExisting: true }).pipe(Layer.provide(PubSubService.layer))

export class PubSubLoggerService extends ServiceMap.Service<PubSubLoggerService>()(
  "@blikka/pubsub/logger",
  {
    make: Effect.succeed({}),
  }
) {
  static readonly layer = Layer.effect(this, this.make)

  static withTaskName(taskName: string) {
    return makePubSubLogger(taskName)
  }
}
