import {
  PublishCommand,
  GetSMSAttributesCommand,
  SetSMSAttributesCommand,
  CheckIfPhoneNumberIsOptedOutCommand,
  ListPhoneNumbersOptedOutCommand,
  OptInPhoneNumberCommand,
} from '@aws-sdk/client-sns'
import { Effect, Layer } from 'effect'
import { SNSEffectClient, SNSEffectClientLayer, SNSEffectError } from './clients/sns-effect-client'

export * from './sms-contract'
import { SMSService, SMSServiceError, type SendSMSParams } from './sms-contract'
import { TwilioSMSServiceLayer } from './twilio-sms-service'
import { isVercelByCamera } from './deployment'

const makeSMSService = Effect.gen(function* () {
  const snsClient = yield* SNSEffectClient

  const send = Effect.fn('SMSService.send')(
    function* (params: SendSMSParams) {
      const command = new PublishCommand({
        PhoneNumber: params.phoneNumber,
        Message: params.message,
        MessageAttributes: params.messageAttributes,
      })
      const result = yield* snsClient.use((client) => client.send(command))

      if (!result.MessageId) {
        return yield* Effect.fail(
          new SMSServiceError({
            message: 'No MessageId returned from SNS',
          }),
        )
      }

      return {
        messageId: result.MessageId,
        phoneNumber: params.phoneNumber,
        status: 'success' as const,
      }
    },
    Effect.mapError((error) => {
      if (error instanceof SNSEffectError) {
        return new SMSServiceError({
          cause: error,
          message: error.message ?? 'SNS client error',
        })
      }
      return new SMSServiceError({
        cause: error,
        message: 'Unexpected SMS error',
      })
    }),
  )

  const sendBatch = Effect.fn('SMSService.sendBatch')(function* (params: SendSMSParams[]) {
    const results = yield* Effect.all(
      params.map((param) =>
        send(param).pipe(
          Effect.matchEffect({
            onSuccess: (result) => Effect.succeed(result),
            onFailure: (error) =>
              Effect.succeed({
                messageId: '',
                phoneNumber: param.phoneNumber,
                status: 'failed' as const,
                error: error instanceof SMSServiceError ? error.message : 'Unknown error',
              }),
          }),
        ),
      ),
      { concurrency: 5 },
    )

    return results
  })

  const getDeliveryStatus = Effect.fn('SMSService.getDeliveryStatus')(
    function* (messageId: string) {
      const command = new GetSMSAttributesCommand({
        attributes: [
          'MonthlySpendLimit',
          'DeliveryStatusIAMRole',
          'DeliveryStatusSuccessSamplingRate',
          'DefaultSenderID',
          'DefaultSMSType',
          'UsageReportS3Bucket',
        ],
      })

      const result = yield* snsClient.use((client) => client.send(command))

      return {
        messageId,
        attributes: result.attributes ?? {},
      }
    },
    Effect.mapError((error) => {
      if (error instanceof SNSEffectError) {
        return new SMSServiceError({
          cause: error,
          message: error.message ?? 'Failed to get delivery status',
        })
      }
      return new SMSServiceError({
        cause: error,
        message: 'Unexpected error getting delivery status',
      })
    }),
  )

  const configureDeliveryTracking = Effect.fn('SMSService.configureDeliveryTracking')(
    function* (iamRoleArn: string, samplingRate?: number) {
      const attributes: Record<string, string> = {
        DeliveryStatusIAMRole: iamRoleArn,
      }

      if (samplingRate !== undefined) {
        attributes['DeliveryStatusSuccessSamplingRate'] = samplingRate.toString()
      }

      const command = new SetSMSAttributesCommand({
        attributes,
      })

      yield* snsClient.use((client) => client.send(command))

      return { configured: true }
    },
    Effect.mapError((error) => {
      if (error instanceof SNSEffectError) {
        return new SMSServiceError({
          cause: error,
          message: error.message ?? 'Failed to configure delivery tracking',
        })
      }
      return new SMSServiceError({
        cause: error,
        message: 'Unexpected error configuring delivery tracking',
      })
    }),
  )

  const isOptedOut = Effect.fn('SMSService.isOptedOut')(
    function* (phoneNumber: string) {
      const command = new CheckIfPhoneNumberIsOptedOutCommand({
        phoneNumber,
      })

      const result = yield* snsClient.use((client) => client.send(command))

      return { optedOut: result.isOptedOut ?? false }
    },
    Effect.mapError((error) => {
      if (error instanceof SNSEffectError) {
        return new SMSServiceError({
          cause: error,
          message: error.message ?? 'Failed to check opt-out status',
        })
      }
      return new SMSServiceError({
        cause: error,
        message: 'Unexpected error checking opt-out status',
      })
    }),
  )

  const listOptedOut = Effect.fn('SMSService.listOptedOut')(
    function* (nextToken?: string) {
      const command = new ListPhoneNumbersOptedOutCommand({
        nextToken,
      })

      const result = yield* snsClient.use((client) => client.send(command))

      return {
        phoneNumbers: result.phoneNumbers ?? [],
        nextToken: result.nextToken,
      }
    },
    Effect.mapError((error) => {
      if (error instanceof SNSEffectError) {
        return new SMSServiceError({
          cause: error,
          message: error.message ?? 'Failed to list opted-out numbers',
        })
      }
      return new SMSServiceError({
        cause: error,
        message: 'Unexpected error listing opted-out numbers',
      })
    }),
  )

  const optIn = Effect.fn('SMSService.optIn')(
    function* (phoneNumber: string) {
      const command = new OptInPhoneNumberCommand({
        phoneNumber,
      })

      yield* snsClient.use((client) => client.send(command))

      return { optedIn: true }
    },
    Effect.mapError((error) => {
      if (error instanceof SNSEffectError) {
        return new SMSServiceError({
          cause: error,
          message: error.message ?? 'Failed to opt in phone number',
        })
      }
      return new SMSServiceError({
        cause: error,
        message: 'Unexpected error opting in phone number',
      })
    }),
  )

  const sendWithOptOutCheck = Effect.fn('SMSService.sendWithOptOutCheck')(function* (
    params: SendSMSParams,
  ) {
    const optedOut = yield* isOptedOut(params.phoneNumber)

    if (optedOut.optedOut) {
      return yield* Effect.fail(
        new SMSServiceError({
          message: `Phone number ${params.phoneNumber} has opted out of SMS messages`,
        }),
      )
    }

    return yield* send(params)
  })

  return SMSService.of({
    send,
    sendBatch,
    getDeliveryStatus,
    configureDeliveryTracking,
    isOptedOut,
    listOptedOut,
    optIn,
    sendWithOptOutCheck,
  })
})

export const SMSServiceLayerNoDeps = Layer.effect(SMSService, makeSMSService)

export const SMSServiceLayer =
  isVercelByCamera() && process.env.SMS_PROVIDER !== 'sns'
    ? TwilioSMSServiceLayer
    : SMSServiceLayerNoDeps.pipe(Layer.provide(SNSEffectClientLayer))
