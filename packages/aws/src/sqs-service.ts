import { Effect, Layer, Schema, Context } from 'effect'
import { SQSEffectClient, SQSEffectClientLayer } from './clients/sqs-effect-client'
import { SendMessageCommand, type SendMessageCommandOutput } from '@aws-sdk/client-sqs'

export class SQSServiceError extends Schema.TaggedErrorClass<SQSServiceError>()('SQSServiceError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SQSService extends Context.Service<
  SQSService,
  {
    /**
     * Send a message to an SQS queue.
     */
    readonly sendMessage: (
      queueUrl: string,
      message: string,
    ) => Effect.Effect<SendMessageCommandOutput, SQSServiceError, never>
  }
>()('@blikka/aws/sqs-service') {}

const makeSQSService = Effect.gen(function* () {
  const sqsClient = yield* SQSEffectClient

  const sendMessage: SQSService['Service']['sendMessage'] = Effect.fn('SQSService.sendMessage')(
    function* (queueUrl: string, message: string) {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: message,
      })
      return yield* sqsClient.use((client) => client.send(command))
    },
    Effect.mapError((error) => {
      return new SQSServiceError({
        cause: error,
        message: error.message ?? 'Unexpected SQS error',
      })
    }),
  )

  return SQSService.of({
    sendMessage,
  })
})

export const SQSServiceLayer = Layer.effect(SQSService, makeSQSService).pipe(
  Layer.provide(SQSEffectClientLayer),
)
