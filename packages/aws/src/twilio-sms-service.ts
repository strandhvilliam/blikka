import { Config, Effect, Layer, Schema } from 'effect'
import { SMSService, SMSServiceError, type SendSMSParams } from './sms-contract'

const MessageResponse = Schema.Struct({ sid: Schema.String })

export const TwilioSMSServiceLayer = Layer.effect(
  SMSService,
  Effect.gen(function* () {
    // Resolve credentials only when sending so browsing the app does not require SMS setup.
    const send = Effect.fn('TwilioSMSService.send')(
      function* (params: SendSMSParams) {
        const account = yield* Config.string('TWILIO_ACCOUNT_SID')
        const apiKey = yield* Config.string('TWILIO_API_KEY_SID')
        const apiSecret = yield* Config.string('TWILIO_API_KEY_SECRET')
        const messagingService = yield* Config.string('TWILIO_MESSAGING_SERVICE_SID')
        const region = yield* Config.string('TWILIO_REGION').pipe(Config.withDefault('ie1'))
        if (region !== 'ie1' && region !== 'us1') {
          return yield* new SMSServiceError({
            message: 'TWILIO_REGION must be ie1 or us1 and match the API key region',
          })
        }
        const origin =
          region === 'ie1' ? 'https://api.dublin.ie1.twilio.com' : 'https://api.twilio.com'
        const result = yield* Effect.tryPromise({
          try: async () => {
            const response = await fetch(
              `${origin}/2010-04-01/Accounts/${encodeURIComponent(account)}/Messages.json`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  To: params.phoneNumber,
                  Body: params.message,
                  MessagingServiceSid: messagingService,
                }),
                signal: AbortSignal.timeout(15000),
              },
            )
            if (!response.ok) throw new Error(`Twilio rejected the message (${response.status})`)
            return Schema.decodeUnknownSync(MessageResponse)(await response.json())
          },
          catch: (cause) =>
            new SMSServiceError({ message: 'Failed to send SMS through Twilio', cause }),
        })
        return {
          messageId: result.sid,
          phoneNumber: params.phoneNumber,
          status: 'success' as const,
        }
      },
      Effect.mapError(
        (cause) => new SMSServiceError({ message: 'Failed to send SMS through Twilio', cause }),
      ),
    )

    const unsupported = () =>
      Effect.fail(
        new SMSServiceError({
          message: 'Manage SMS delivery and opt-out settings in Twilio for this deployment',
        }),
      )
    return SMSService.of({
      send,
      // Twilio Messaging Services enforce recipient opt-outs when sending.
      sendWithOptOutCheck: send,
      sendBatch: (messages) =>
        Effect.forEach(
          messages,
          (message) =>
            send(message).pipe(
              Effect.catch((error) =>
                Effect.succeed({
                  messageId: '',
                  phoneNumber: message.phoneNumber,
                  status: 'failed' as const,
                  error: error.message,
                }),
              ),
            ),
          { concurrency: 5 },
        ),
      getDeliveryStatus: unsupported,
      configureDeliveryTracking: unsupported,
      isOptedOut: unsupported,
      listOptedOut: unsupported,
      optIn: unsupported,
    })
  }),
)
