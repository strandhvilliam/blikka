import { Effect, Layer, Schema, ServiceMap } from "effect"
import { SQSEffectClient } from "./sqs-effect-client"
import { SendMessageCommand } from "@aws-sdk/client-sqs"

export class SQSServiceError extends Schema.TaggedErrorClass<SQSServiceError>()("SQSServiceError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class SQSService extends ServiceMap.Service<SQSService>()("@blikka/aws/sqs-service", {
  make: Effect.gen(function* () {
    const sqsClient = yield* SQSEffectClient

    const sendMessage = Effect.fn("SQSService.sendMessage")(function* (queueUrl: string, message: string) {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: message,
      })
      return yield* sqsClient.use((client) => client.send(command))
    }, Effect.mapError((error) => {
      return new SQSServiceError({
        cause: error,
        message: error.message ?? "Unexpected SQS error",
      })
    }))

    return {
      sendMessage,
    } as const
  })
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(SQSEffectClient.layer),
  )
} 