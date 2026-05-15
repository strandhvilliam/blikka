import {
  PublishCommand,
  GetSMSAttributesCommand,
  SetSMSAttributesCommand,
  CheckIfPhoneNumberIsOptedOutCommand,
  ListPhoneNumbersOptedOutCommand,
  OptInPhoneNumberCommand,
  type MessageAttributeValue,
  type GetSMSAttributesCommandOutput,
} from "@aws-sdk/client-sns"
import { Effect, Layer, Schema, Context } from "effect"
import { SNSEffectClient, SNSEffectClientLayer, SNSEffectError } from "./clients/sns-effect-client"

export interface SendSMSParams {
  readonly phoneNumber: string
  readonly message: string
  readonly messageAttributes?: Record<string, MessageAttributeValue>
}

export interface SMSDeliveryResult {
  readonly messageId: string
  readonly phoneNumber: string
  readonly status: "success" | "failed"
  readonly error?: string
}

export interface SMSDeliveryStatus {
  readonly messageId: string
  readonly attributes: GetSMSAttributesCommandOutput["attributes"]
}

export class SMSServiceError extends Schema.TaggedErrorClass<SMSServiceError>()("SMSServiceError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SMSService extends Context.Service<
  SMSService,
  {
    /**
     * Send an SMS message to a single phone number.
     */
    readonly send: (
      params: SendSMSParams,
    ) => Effect.Effect<SMSDeliveryResult, SMSServiceError, never>
    /**
     * Send SMS messages to multiple phone numbers in a single batch.
     */
    readonly sendBatch: (
      params: SendSMSParams[],
    ) => Effect.Effect<SMSDeliveryResult[], SMSServiceError, never>
    /**
     * Get the delivery status of an SMS message.
     */
    readonly getDeliveryStatus: (
      messageId: string,
    ) => Effect.Effect<SMSDeliveryStatus, SMSServiceError, never>
    /**
     * Configure delivery tracking for an SMS message.
     */
    readonly configureDeliveryTracking: (
      iamRoleArn: string,
      samplingRate?: number,
    ) => Effect.Effect<{ configured: boolean }, SMSServiceError, never>
    /**
     * Check if a phone number is opted out of SMS messages.
     */
    readonly isOptedOut: (
      phoneNumber: string,
    ) => Effect.Effect<{ optedOut: boolean }, SMSServiceError, never>
    /**
     * List opted out phone numbers.
     */
    readonly listOptedOut: (
      nextToken?: string,
    ) => Effect.Effect<{ phoneNumbers: string[]; nextToken?: string }, SMSServiceError, never>
    /**
     * Opt in a phone number to SMS messages.
     */
    readonly optIn: (
      phoneNumber: string,
    ) => Effect.Effect<{ optedIn: boolean }, SMSServiceError, never>
    /**
     * Send an SMS message with opt-out check.
     */
    readonly sendWithOptOutCheck: (
      params: SendSMSParams,
    ) => Effect.Effect<SMSDeliveryResult, SMSServiceError, never>
  }
>()("@blikka/aws/sms-service") {}

const makeSMSService = Effect.gen(function* () {
  const snsClient = yield* SNSEffectClient

  const send = Effect.fn("SMSService.send")(
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
            message: "No MessageId returned from SNS",
          }),
        )
      }

      return {
        messageId: result.MessageId,
        phoneNumber: params.phoneNumber,
        status: "success" as const,
      }
    },
    Effect.mapError((error) => {
      if (error instanceof SNSEffectError) {
        return new SMSServiceError({
          cause: error,
          message: error.message ?? "SNS client error",
        })
      }
      return new SMSServiceError({
        cause: error,
        message: "Unexpected SMS error",
      })
    }),
  )

  const sendBatch = Effect.fn("SMSService.sendBatch")(function* (params: SendSMSParams[]) {
    const results = yield* Effect.all(
      params.map((param) =>
        send(param).pipe(
          Effect.matchEffect({
            onSuccess: (result) => Effect.succeed(result),
            onFailure: (error) =>
              Effect.succeed({
                messageId: "",
                phoneNumber: param.phoneNumber,
                status: "failed" as const,
                error: error instanceof SMSServiceError ? error.message : "Unknown error",
              }),
          }),
        ),
      ),
      { concurrency: 5 },
    )

    return results
  })

  const getDeliveryStatus = Effect.fn("SMSService.getDeliveryStatus")(
    function* (messageId: string) {
      const command = new GetSMSAttributesCommand({
        attributes: [
          "MonthlySpendLimit",
          "DeliveryStatusIAMRole",
          "DeliveryStatusSuccessSamplingRate",
          "DefaultSenderID",
          "DefaultSMSType",
          "UsageReportS3Bucket",
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
          message: error.message ?? "Failed to get delivery status",
        })
      }
      return new SMSServiceError({
        cause: error,
        message: "Unexpected error getting delivery status",
      })
    }),
  )

  const configureDeliveryTracking = Effect.fn("SMSService.configureDeliveryTracking")(
    function* (iamRoleArn: string, samplingRate?: number) {
      const attributes: Record<string, string> = {
        DeliveryStatusIAMRole: iamRoleArn,
      }

      if (samplingRate !== undefined) {
        attributes["DeliveryStatusSuccessSamplingRate"] = samplingRate.toString()
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
          message: error.message ?? "Failed to configure delivery tracking",
        })
      }
      return new SMSServiceError({
        cause: error,
        message: "Unexpected error configuring delivery tracking",
      })
    }),
  )

  const isOptedOut = Effect.fn("SMSService.isOptedOut")(
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
          message: error.message ?? "Failed to check opt-out status",
        })
      }
      return new SMSServiceError({
        cause: error,
        message: "Unexpected error checking opt-out status",
      })
    }),
  )

  const listOptedOut = Effect.fn("SMSService.listOptedOut")(
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
          message: error.message ?? "Failed to list opted-out numbers",
        })
      }
      return new SMSServiceError({
        cause: error,
        message: "Unexpected error listing opted-out numbers",
      })
    }),
  )

  const optIn = Effect.fn("SMSService.optIn")(
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
          message: error.message ?? "Failed to opt in phone number",
        })
      }
      return new SMSServiceError({
        cause: error,
        message: "Unexpected error opting in phone number",
      })
    }),
  )

  const sendWithOptOutCheck = Effect.fn("SMSService.sendWithOptOutCheck")(function* (
    params: SendSMSParams,
  ) {
    const optedOut = yield* isOptedOut(params.phoneNumber)

    if (optedOut) {
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

export const SMSServiceLayer = Layer.effect(SMSService, makeSMSService).pipe(
  Layer.provide(SNSEffectClientLayer),
)
