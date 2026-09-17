import type { MessageAttributeValue, GetSMSAttributesCommandOutput } from '@aws-sdk/client-sns'
import { Context, Effect, Schema } from 'effect'

export interface SendSMSParams {
  readonly phoneNumber: string
  readonly message: string
  readonly messageAttributes?: Record<string, MessageAttributeValue>
}

export interface SMSDeliveryResult {
  readonly messageId: string
  readonly phoneNumber: string
  readonly status: 'success' | 'failed'
  readonly error?: string
}

export interface SMSDeliveryStatus {
  readonly messageId: string
  readonly attributes: GetSMSAttributesCommandOutput['attributes']
}

export class SMSServiceError extends Schema.TaggedErrorClass<SMSServiceError>()('SMSServiceError', {
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
>()('@blikka/aws/sms-service') {}
