import { Effect, Layer, Schema, Context } from 'effect'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import { ResendEffectClient, ResendEffectClientLayer } from './resend-effect-client'

export interface SendEmailAttachment {
  readonly content?: string | Buffer
  readonly filename?: string | false
  readonly path?: string
  readonly contentType?: string
  readonly inlineContentId?: string
}

export interface SendEmailParams {
  readonly to: string | string[]
  readonly from?: string
  readonly subject: string
  readonly template: ReactElement
  readonly attachments?: SendEmailAttachment[]
  readonly replyTo?: string
  readonly cc?: string | string[]
  readonly bcc?: string | string[]
  readonly tags?: Array<{ name: string; value: string }>
}

export class SendEmailError extends Schema.TaggedErrorClass<SendEmailError>()('SendEmailError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class EmailService extends Context.Service<
  EmailService,
  {
    /** Send a single email. */
    readonly send: (
      params: SendEmailParams,
    ) => Effect.Effect<{ readonly id: string }, SendEmailError>
    /** Send a batch of emails. */
    readonly sendBatch: (
      params: SendEmailParams[],
    ) => Effect.Effect<readonly string[], SendEmailError>
  }
>()('@blikka/email/email-service') {}

function sanitizeTagPart(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')

  return normalized || 'unknown'
}

function sanitizeTags(tags: SendEmailParams['tags']) {
  return tags?.map((tag) => ({
    name: sanitizeTagPart(tag.name),
    value: sanitizeTagPart(tag.value),
  }))
}

const makeEmailService = Effect.gen(function* () {
  const resendClient = yield* ResendEffectClient

  const send: EmailService['Service']['send'] = Effect.fn('EmailService.send')(function* (
    params: SendEmailParams,
  ) {
    const html = yield* Effect.tryPromise({
      try: () => render(params.template),
      catch: (error) =>
        new SendEmailError({
          cause: error,
          message:
            error instanceof Error ? error.message : 'Unknown error in render email template',
        }),
    })

    const result = yield* resendClient
      .use((client) =>
        client.emails.send({
          from: params.from ?? 'support@blikka.app',
          to: params.to,
          subject: params.subject,
          html,
          attachments: params.attachments,
          replyTo: params.replyTo,
          cc: params.cc,
          bcc: params.bcc,
          tags: sanitizeTags(params.tags),
        }),
      )
      .pipe(
        Effect.mapError(
          (error) =>
            new SendEmailError({
              cause: error,
              message: error.message,
            }),
        ),
      )

    if (result.error) {
      return yield* new SendEmailError({
        cause: result.error,
        message: result.error.message ?? 'Unknown error in send email',
      })
    }

    if (!result.data) {
      return yield* new SendEmailError({
        message: 'No data returned from Resend',
      })
    }

    return { id: result.data.id }
  })

  const sendBatch: EmailService['Service']['sendBatch'] = Effect.fn('EmailService.sendBatch')(
    function* (params: SendEmailParams[]) {
      const htmlArray = yield* Effect.all(
        params.map((param) =>
          Effect.tryPromise({
            try: () => render(param.template),
            catch: (error) =>
              new SendEmailError({
                cause: error,
                message:
                  error instanceof Error ? error.message : 'Unknown error in render email template',
              }),
          }),
        ),
      )

      const emails = params.map((param, index) => ({
        from: param.from ?? 'support@blikka.app',
        to: param.to,
        subject: param.subject,
        html: htmlArray[index]!,
        attachments: param.attachments,
        replyTo: param.replyTo,
        cc: param.cc,
        bcc: param.bcc,
        tags: sanitizeTags(param.tags),
      }))

      const result = yield* resendClient
        .use((client) => client.batch.send(emails))
        .pipe(
          Effect.mapError(
            (error) =>
              new SendEmailError({
                cause: error,
                message: error.message,
              }),
          ),
        )

      if (result.error) {
        return yield* new SendEmailError({
          cause: result.error,
          message: result.error.message ?? 'Unknown error in send batch emails',
        })
      }

      if (!result.data) {
        return yield* new SendEmailError({
          message: 'No data returned from Resend batch send',
        })
      }

      return result.data.data.map((item) => item.id)
    },
  )

  return EmailService.of({
    send,
    sendBatch,
  })
})

export const EmailServiceLayerNoDeps = Layer.effect(EmailService, makeEmailService)

export const EmailServiceLayer = EmailServiceLayerNoDeps.pipe(
  Layer.provide(ResendEffectClientLayer),
)
