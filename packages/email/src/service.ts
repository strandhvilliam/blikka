import { Config, Effect, Layer, Schema, Context } from "effect"
import { Resend } from "resend"
import { render } from "@react-email/render"
import type { ReactElement } from "react"

export interface SendEmailParams {
  readonly to: string | string[]
  readonly from?: string
  readonly subject: string
  readonly template: ReactElement
  readonly replyTo?: string
  readonly cc?: string | string[]
  readonly bcc?: string | string[]
  readonly tags?: Array<{ name: string; value: string }>
}

export class SendEmailError extends Schema.TaggedErrorClass<SendEmailError>()("SendEmailError", {
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
>()("@blikka/email/email-service") {}

function sanitizeTagPart(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")

  return normalized || "unknown"
}

function sanitizeTags(tags: SendEmailParams["tags"]) {
  return tags?.map((tag) => ({
    name: sanitizeTagPart(tag.name),
    value: sanitizeTagPart(tag.value),
  }))
}

const makeEmailService = Effect.gen(function* () {
  const apiKey = yield* Config.string("RESEND_API_KEY")
  const resend = new Resend(apiKey)

  const use = <T>(fn: (client: Resend) => T): Effect.Effect<Awaited<T>, SendEmailError> =>
    Effect.gen(function* () {
      const result = yield* Effect.try({
        try: () => fn(resend),
        catch: (error) =>
          new SendEmailError({
            cause: error,
            message:
              error instanceof Error ? error.message : "Unknown error in SendEmailError.use (Sync)",
          }),
      })
      if (result instanceof Promise) {
        return yield* Effect.tryPromise({
          try: () => result,
          catch: (e) =>
            new SendEmailError({
              cause: e,
              message:
                e instanceof Error ? e.message : "Unknown error in SendEmailError.use (Async)",
            }),
        })
      }
      return result
    })

  const send: EmailService["Service"]["send"] = Effect.fn("EmailService.send")(function* (
    params: SendEmailParams,
  ) {
    const html = yield* Effect.tryPromise({
      try: () => render(params.template),
      catch: (error) =>
        new SendEmailError({
          cause: error,
          message:
            error instanceof Error ? error.message : "Unknown error in render email template",
        }),
    })

    const result = yield* use((client) =>
      client.emails.send({
        from: params.from ?? "support@blikka.app",
        to: params.to,
        subject: params.subject,
        html,
        replyTo: params.replyTo,
        cc: params.cc,
        bcc: params.bcc,
        tags: sanitizeTags(params.tags),
      }),
    )

    if (result.error) {
      return yield* new SendEmailError({
        cause: result.error,
        message: result.error.message ?? "Unknown error in send email",
      })
    }

    if (!result.data) {
      return yield* new SendEmailError({
        message: "No data returned from Resend",
      })
    }

    return { id: result.data.id }
  })

  const sendBatch: EmailService["Service"]["sendBatch"] = Effect.fn("EmailService.sendBatch")(
    function* (params: SendEmailParams[]) {
      const htmlArray = yield* Effect.all(
        params.map((param) =>
          Effect.tryPromise({
            try: () => render(param.template),
            catch: (error) =>
              new SendEmailError({
                cause: error,
                message:
                  error instanceof Error ? error.message : "Unknown error in render email template",
              }),
          }),
        ),
      )

      const emails = params.map((param, index) => ({
        from: param.from ?? "support@blikka.app",
        to: param.to,
        subject: param.subject,
        html: htmlArray[index]!,
        replyTo: param.replyTo,
        cc: param.cc,
        bcc: param.bcc,
        tags: sanitizeTags(param.tags),
      }))

      const result = yield* use((client) => client.batch.send(emails))

      if (result.error) {
        return yield* new SendEmailError({
          cause: result.error,
          message: result.error.message ?? "Unknown error in send batch emails",
        })
      }

      if (!result.data) {
        return yield* new SendEmailError({
          message: "No data returned from Resend batch send",
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

export const EmailServiceLayer = Layer.effect(EmailService, makeEmailService)
