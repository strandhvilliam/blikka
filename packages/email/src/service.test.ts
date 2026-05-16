import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import React from "react"
import type { Resend } from "resend"

import { EmailService, EmailServiceLayerNoDeps, SendEmailError } from "./service"
import { ResendEffectClient, ResendEffectError } from "./resend-effect-client"

type SendMode = "ok" | "error" | "noData" | "reject"

interface ResendFakeOptions {
  readonly sendSequence?: ReadonlyArray<SendMode>
  readonly batchSequence?: ReadonlyArray<SendMode>
}

interface SendCall {
  readonly from?: string
  readonly to?: string | string[]
  readonly subject?: string
  readonly html?: string
  readonly replyTo?: string
  readonly cc?: string | string[]
  readonly bcc?: string | string[]
  readonly tags?: Array<{ name: string; value: string }>
}

interface BatchCall {
  readonly emails: ReadonlyArray<SendCall>
}

function makeTemplate(text = "Hello from test") {
  return React.createElement("div", null, text)
}

function makeResendTestLayer(opts: ResendFakeOptions = {}) {
  const sendCalls: SendCall[] = []
  const batchCalls: BatchCall[] = []
  const sendSequence = [...(opts.sendSequence ?? ["ok"])]
  const batchSequence = [...(opts.batchSequence ?? ["ok"])]
  let sendIndex = 0
  let batchIndex = 0

  const fakeClient = {
    emails: {
      send: (input: SendCall) => {
        sendCalls.push(input)
        const mode = sendSequence[sendIndex] ?? "ok"
        sendIndex += 1
        if (mode === "reject") {
          return Promise.reject(new Error("resend transport failed"))
        }
        if (mode === "error") {
          return Promise.resolve({
            error: { message: "resend rejected email" },
          })
        }
        if (mode === "noData") {
          return Promise.resolve({})
        }
        return Promise.resolve({ data: { id: `email-${sendIndex}` } })
      },
    },
    batch: {
      send: (emails: ReadonlyArray<SendCall>) => {
        batchCalls.push({ emails })
        const mode = batchSequence[batchIndex] ?? "ok"
        batchIndex += 1
        if (mode === "reject") {
          return Promise.reject(new Error("resend batch transport failed"))
        }
        if (mode === "error") {
          return Promise.resolve({
            error: { message: "resend rejected batch" },
          })
        }
        if (mode === "noData") {
          return Promise.resolve({})
        }
        return Promise.resolve({
          data: {
            data: emails.map((_, index) => ({
              id: `batch-${batchIndex}-${index + 1}`,
            })),
          },
        })
      },
    },
  }

  const fakeResend = ResendEffectClient.of({
    use: (fn) =>
      Effect.gen(function* () {
        const result = fn(fakeClient as unknown as Resend)
        if (result instanceof Promise) {
          return yield* Effect.tryPromise({
            try: () => result,
            catch: (e) =>
              new ResendEffectError({
                message: e instanceof Error ? e.message : "resend error",
                cause: e,
              }),
          })
        }
        return result
      }),
  })

  const layer = EmailServiceLayerNoDeps.pipe(
    Layer.provide(Layer.succeed(ResendEffectClient)(fakeResend)),
  )

  return { layer, sendCalls, batchCalls }
}

describe("EmailService", () => {
  it.effect("send renders and sends an email through Resend", () => {
    const { layer, sendCalls } = makeResendTestLayer()

    return Effect.gen(function* () {
      const email = yield* EmailService
      const out = yield* email.send({
        to: ["a@example.com", "b@example.com"],
        subject: "Subject",
        template: makeTemplate("Rendered body"),
        replyTo: "reply@example.com",
        cc: "cc@example.com",
        bcc: ["bcc@example.com"],
        tags: [{ name: "Participant Ref!", value: "ÅBC 123 !!!" }],
      })

      assert.deepStrictEqual(out, { id: "email-1" })
      assert.strictEqual(sendCalls.length, 1)
      assert.strictEqual(sendCalls[0]?.from, "support@blikka.app")
      assert.deepStrictEqual(sendCalls[0]?.to, ["a@example.com", "b@example.com"])
      assert.strictEqual(sendCalls[0]?.subject, "Subject")
      assert.match(sendCalls[0]?.html ?? "", /Rendered body/)
      assert.strictEqual(sendCalls[0]?.replyTo, "reply@example.com")
      assert.strictEqual(sendCalls[0]?.cc, "cc@example.com")
      assert.deepStrictEqual(sendCalls[0]?.bcc, ["bcc@example.com"])
      assert.deepStrictEqual(sendCalls[0]?.tags, [{ name: "Participant-Ref", value: "ABC-123" }])
    }).pipe(Effect.provide(layer))
  })

  it.effect("send uses an explicit from address when provided", () => {
    const { layer, sendCalls } = makeResendTestLayer()

    return Effect.gen(function* () {
      const email = yield* EmailService
      yield* email.send({
        from: "events@example.com",
        to: "a@example.com",
        subject: "Subject",
        template: makeTemplate(),
      })

      assert.strictEqual(sendCalls[0]?.from, "events@example.com")
    }).pipe(Effect.provide(layer))
  })

  it.effect("send fails when Resend returns an error", () => {
    const { layer } = makeResendTestLayer({ sendSequence: ["error"] })

    return Effect.gen(function* () {
      const email = yield* EmailService
      const err = yield* Effect.flip(
        email.send({
          to: "a@example.com",
          subject: "Subject",
          template: makeTemplate(),
        }),
      )

      assert.instanceOf(err, SendEmailError)
      assert.strictEqual(err.message, "resend rejected email")
    }).pipe(Effect.provide(layer))
  })

  it.effect("send fails when Resend returns no data", () => {
    const { layer } = makeResendTestLayer({ sendSequence: ["noData"] })

    return Effect.gen(function* () {
      const email = yield* EmailService
      const err = yield* Effect.flip(
        email.send({
          to: "a@example.com",
          subject: "Subject",
          template: makeTemplate(),
        }),
      )

      assert.instanceOf(err, SendEmailError)
      assert.strictEqual(err.message, "No data returned from Resend")
    }).pipe(Effect.provide(layer))
  })

  it.effect("send maps Resend client failures into SendEmailError", () => {
    const { layer } = makeResendTestLayer({ sendSequence: ["reject"] })

    return Effect.gen(function* () {
      const email = yield* EmailService
      const err = yield* Effect.flip(
        email.send({
          to: "a@example.com",
          subject: "Subject",
          template: makeTemplate(),
        }),
      )

      assert.instanceOf(err, SendEmailError)
      assert.strictEqual(err.message, "resend transport failed")
      assert.instanceOf(err.cause, ResendEffectError)
    }).pipe(Effect.provide(layer))
  })

  it.effect("sendBatch renders and sends all emails through Resend batch", () => {
    const { layer, batchCalls } = makeResendTestLayer()

    return Effect.gen(function* () {
      const email = yield* EmailService
      const out = yield* email.sendBatch([
        {
          to: "a@example.com",
          subject: "First",
          template: makeTemplate("First body"),
        },
        {
          from: "events@example.com",
          to: "b@example.com",
          subject: "Second",
          template: makeTemplate("Second body"),
          tags: [{ name: " ", value: "%%%" }],
        },
      ])

      assert.deepStrictEqual(out, ["batch-1-1", "batch-1-2"])
      assert.strictEqual(batchCalls.length, 1)
      assert.strictEqual(batchCalls[0]?.emails[0]?.from, "support@blikka.app")
      assert.strictEqual(batchCalls[0]?.emails[0]?.subject, "First")
      assert.match(batchCalls[0]?.emails[0]?.html ?? "", /First body/)
      assert.strictEqual(batchCalls[0]?.emails[1]?.from, "events@example.com")
      assert.strictEqual(batchCalls[0]?.emails[1]?.subject, "Second")
      assert.match(batchCalls[0]?.emails[1]?.html ?? "", /Second body/)
      assert.deepStrictEqual(batchCalls[0]?.emails[1]?.tags, [
        { name: "unknown", value: "unknown" },
      ])
    }).pipe(Effect.provide(layer))
  })

  it.effect("sendBatch fails when Resend returns an error", () => {
    const { layer } = makeResendTestLayer({ batchSequence: ["error"] })

    return Effect.gen(function* () {
      const email = yield* EmailService
      const err = yield* Effect.flip(
        email.sendBatch([
          {
            to: "a@example.com",
            subject: "Subject",
            template: makeTemplate(),
          },
        ]),
      )

      assert.instanceOf(err, SendEmailError)
      assert.strictEqual(err.message, "resend rejected batch")
    }).pipe(Effect.provide(layer))
  })
})
