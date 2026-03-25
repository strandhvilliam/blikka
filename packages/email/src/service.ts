import { Config, Data, Effect, Layer, Schema, ServiceMap } from "effect"
import { Resend, type CreateBatchOptions, type CreateEmailOptions } from "resend"
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

export class EmailService extends ServiceMap.Service<EmailService>()(
  "@blikka/email/email-service",
  {
    make: Effect.gen(function* () {
      const apiKey = yield* Config.string("RESEND_API_KEY")
      const resend = new Resend(apiKey)

      const use = <T>(
        fn: (client: Resend) => T,
      ): Effect.Effect<Awaited<T>, SendEmailError, never> =>
        Effect.gen(function* () {
          const result = yield* Effect.try({
            try: () => fn(resend),
            catch: (error) =>
              new SendEmailError({
                cause: error,
                message:
                  error instanceof Error
                    ? error.message
                    : "Unknown error in SendEmailError.use (Sync)",
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
          } else {
            return result
          }
        })

      const send = Effect.fn("@blikka/email/send")(function* (params: SendEmailParams) {
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
            tags: params.tags,
          }),
        )

        if (result.error) {
          throw new SendEmailError({
            cause: result.error,
            message: result.error.message ?? "Unknown error in send email",
          })
        }

        if (!result.data) {
          throw new SendEmailError({
            message: "No data returned from Resend",
          })
        }

        return { id: result.data.id }
      })

      const sendBatch = Effect.fn("@blikka/email/sendBatch")(function* (params: SendEmailParams[]) {
        const htmlArray = yield* Effect.all(
          params.map((param) =>
            Effect.tryPromise({
              try: () => render(param.template),
              catch: (error) =>
                new SendEmailError({
                  cause: error,
                  message:
                    error instanceof Error
                      ? error.message
                      : "Unknown error in render email template",
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
          tags: param.tags,
        }))

        const result = yield* use((client) => client.batch.send(emails))

        if (result.error) {
          throw new SendEmailError({
            cause: result.error,
            message: result.error.message ?? "Unknown error in send batch emails",
          })
        }

        if (!result.data) {
          throw new SendEmailError({
            message: "No data returned from Resend batch send",
          })
        }

        return result.data.data.map((result) => result.id)
      })

      return {
        send,
        sendBatch,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
