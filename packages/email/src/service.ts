import { Duration, Effect, Layer, Schedule, Schema, Context } from 'effect'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import { ResendEffectClient, ResendEffectClientLayer } from './resend-effect-client'

export interface SendEmailAttachment {
  readonly content?: string | Buffer
  readonly filename?: string | false
  readonly path?: string
  readonly contentType?: string
  readonly contentId?: string
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
  /**
   * Resend idempotency key (`<event-type>/<entity-id>`). Same key + same payload
   * returns the original response without resending. Keys expire after 24 hours.
   */
  readonly idempotencyKey: string
}

export interface SendBatchEmailParams extends Omit<SendEmailParams, 'idempotencyKey' | 'attachments'> {}

export interface SendBatchOptions {
  /**
   * One key for the whole batch (`batch-<event-type>/<batch-id>`).
   * Batch API does not support per-email keys or attachments.
   */
  readonly idempotencyKey: string
}

export class SendEmailError extends Schema.TaggedErrorClass<SendEmailError>()('SendEmailError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  /**
   * The send was rejected *before* Resend accepted the email, so retrying cannot duplicate a
   * delivery. Only rate limits qualify — see `isRateLimitError`. Absent means "do not retry".
   */
  retryable: Schema.optional(Schema.Boolean),
}) {}

/**
 * Resend reports rate limits as a non-throwing `{ error }` result rather than a rejection, so
 * they never surface as a transport error. These are the only failures we retry in-process:
 * the request was refused outright, so a retry is guaranteed not to send a second email.
 *
 * Deliberately NOT retried: 5xx and transport errors. Those are ambiguous — the email may have
 * been accepted and only the response lost — so retrying risks a duplicate. Those keep the
 * existing behaviour of failing the SQS record and redelivering, which is idempotent at the
 * queue level (see `decideContactSheetAction`'s `send-missing-email` branch).
 */
function isRateLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { name, statusCode } = error as { name?: unknown; statusCode?: unknown }
  return statusCode === 429 || name === 'rate_limit_exceeded'
}

/**
 * ~15 s of backoff across 5 attempts (0.5s → 8s). Sized to absorb one wave of concurrent
 * contact-sheet sends draining against Resend's ~10 req/s team limit: at `reserved: 150`, a
 * finalize burst finishes ~150 sheets in a cluster and emits their emails together, which is
 * well over the limit instantaneously even though the average rate is ~5/s.
 *
 * Without this, a rate-limited send fails its SQS record and waits out the queue's 10-minute
 * visibility timeout before retrying — the sheet is already in S3, so the only casualty is the
 * participant's email arriving ~10 minutes late (up to 5 times over, per `retry: 5`).
 *
 * `Schedule.max` stops as soon as either schedule finishes, so `recurs(5)` bounds the retries.
 */
const rateLimitRetry = {
  while: (error: SendEmailError) => error.retryable === true,
  schedule: Schedule.max([Schedule.exponential(Duration.millis(500)), Schedule.recurs(5)]),
}

export class EmailService extends Context.Service<
  EmailService,
  {
    /** Send a single email. */
    readonly send: (
      params: SendEmailParams,
    ) => Effect.Effect<{ readonly id: string }, SendEmailError>
    /** Send a batch of emails. */
    readonly sendBatch: (
      params: SendBatchEmailParams[],
      options: SendBatchOptions,
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
        client.emails.send(
          {
            from: params.from ?? 'support@blikka.app',
            to: params.to,
            subject: params.subject,
            html,
            attachments: params.attachments,
            replyTo: params.replyTo,
            cc: params.cc,
            bcc: params.bcc,
            tags: sanitizeTags(params.tags),
          },
          { idempotencyKey: params.idempotencyKey },
        ),
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
        retryable: isRateLimitError(result.error),
      })
    }

    if (!result.data) {
      return yield* new SendEmailError({
        message: 'No data returned from Resend',
      })
    }

    return { id: result.data.id }
  }, Effect.retry(rateLimitRetry))

  const sendBatch: EmailService['Service']['sendBatch'] = Effect.fn('EmailService.sendBatch')(
    function* (params: SendBatchEmailParams[], options: SendBatchOptions) {
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
        replyTo: param.replyTo,
        cc: param.cc,
        bcc: param.bcc,
        tags: sanitizeTags(param.tags),
      }))

      const result = yield* resendClient
        .use((client) =>
          client.batch.send(emails, { idempotencyKey: options.idempotencyKey }),
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
          message: result.error.message ?? 'Unknown error in send batch emails',
          retryable: isRateLimitError(result.error),
        })
      }

      if (!result.data) {
        return yield* new SendEmailError({
          message: 'No data returned from Resend batch send',
        })
      }

      return result.data.data.map((item) => item.id)
    },
    Effect.retry(rateLimitRetry),
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
