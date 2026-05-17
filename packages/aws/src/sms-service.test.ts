import { assert, describe, it } from '@effect/vitest'
import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns'
import { Effect, Layer } from 'effect'

import { SNSEffectClient, SNSEffectError } from './clients/sns-effect-client'
import { SMSService, SMSServiceError, SMSServiceLayerNoDeps } from './sms-service'

function isPublishCommand(command: unknown): command is PublishCommand {
  return (
    typeof command === 'object' &&
    command !== null &&
    (command as { constructor?: { name?: string } }).constructor?.name === 'PublishCommand'
  )
}

type SendMode = 'ok' | 'noMessageId' | 'reject'

interface SnsFakeOptions {
  readonly optedOut: boolean
  /** Per Publish attempt: defaults to ok */
  sendSequence?: ReadonlyArray<SendMode>
}

const makeSnsTestLayer = (opts: SnsFakeOptions) => {
  const publishCalls: PublishCommand[] = []
  const sequence = [...(opts.sendSequence ?? ['ok'])]
  let sendIndex = 0

  const fakeClient = {
    send: (command: unknown) => {
      const input = (command as { input?: Record<string, unknown> }).input

      /** CheckIfPhoneNumberIsOptedOut uses lowercase `phoneNumber`; Publish uses `PhoneNumber` + `Message`. */
      if (
        input &&
        typeof input.phoneNumber === 'string' &&
        input.Message === undefined &&
        input.PhoneNumber === undefined
      ) {
        return Promise.resolve({ isOptedOut: opts.optedOut })
      }

      if (isPublishCommand(command)) {
        publishCalls.push(command)
        const mode = sequence[sendIndex] ?? 'ok'
        sendIndex += 1
        if (mode === 'reject') {
          return Promise.reject(new Error('sns transport failed'))
        }
        if (mode === 'noMessageId') {
          return Promise.resolve({})
        }
        return Promise.resolve({ MessageId: `mid-${sendIndex}` })
      }
      return Promise.reject(new Error('unexpected SNS command'))
    },
  } satisfies Pick<SNSClient, 'send'>

  const fakeSns = SNSEffectClient.of({
    use: (fn) =>
      Effect.gen(function* () {
        const result = fn(fakeClient as SNSClient)
        if (result instanceof Promise) {
          return yield* Effect.tryPromise({
            try: () => result,
            catch: (e) =>
              new SNSEffectError({
                message: e instanceof Error ? e.message : 'sns error',
                cause: e,
              }),
          })
        }
        return result
      }),
  })

  const layer = SMSServiceLayerNoDeps.pipe(Layer.provide(Layer.succeed(SNSEffectClient)(fakeSns)))

  return { layer, publishCalls }
}

describe('SMSService', () => {
  it.effect('send succeeds when SNS returns MessageId', () => {
    const { layer, publishCalls } = makeSnsTestLayer({ optedOut: false })
    return Effect.gen(function* () {
      const sms = yield* SMSService
      const out = yield* sms.send({
        phoneNumber: '+15550001',
        message: 'hi',
      })
      assert.deepStrictEqual(out, {
        messageId: 'mid-1',
        phoneNumber: '+15550001',
        status: 'success',
      })
      assert.strictEqual(publishCalls.length, 1)
      assert.strictEqual(publishCalls[0]?.input.PhoneNumber, '+15550001')
    }).pipe(Effect.provide(layer))
  })

  it.effect('send fails when SNS omits MessageId', () => {
    const { layer } = makeSnsTestLayer({ optedOut: false, sendSequence: ['noMessageId'] })
    return Effect.gen(function* () {
      const sms = yield* SMSService
      const err = yield* Effect.flip(sms.send({ phoneNumber: '+1', message: 'x' }))
      assert.instanceOf(err, SMSServiceError)
      /** `Effect.fn` `mapError` turns inner `SMSServiceError` into a generic wrapping error. */
      assert.strictEqual(err.message, 'Unexpected SMS error')
      assert.instanceOf(err.cause, SMSServiceError)
      assert.strictEqual(err.cause.message, 'No MessageId returned from SNS')
    }).pipe(Effect.provide(layer))
  })

  it.effect('send maps SNSEffectError into SMSServiceError', () => {
    const { layer } = makeSnsTestLayer({ optedOut: false, sendSequence: ['reject'] })
    return Effect.gen(function* () {
      const sms = yield* SMSService
      const err = yield* Effect.flip(sms.send({ phoneNumber: '+1', message: 'x' }))
      assert.instanceOf(err, SMSServiceError)
      assert.strictEqual(err.message, 'sns transport failed')
      assert.ok(err.cause instanceof SNSEffectError)
    }).pipe(Effect.provide(layer))
  })

  it.effect('sendBatch records failures per number without failing the effect', () => {
    const { layer, publishCalls } = makeSnsTestLayer({
      optedOut: false,
      sendSequence: ['noMessageId', 'ok'],
    })
    return Effect.gen(function* () {
      const sms = yield* SMSService
      const out = yield* sms.sendBatch([
        { phoneNumber: '+111', message: 'a' },
        { phoneNumber: '+222', message: 'b' },
      ])
      const sorted = [...out].sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber))
      assert.deepStrictEqual(sorted, [
        {
          messageId: '',
          phoneNumber: '+111',
          status: 'failed',
          error: 'Unexpected SMS error',
        },
        {
          messageId: 'mid-2',
          phoneNumber: '+222',
          status: 'success',
        },
      ])
      assert.strictEqual(publishCalls.length, 2)
    }).pipe(Effect.provide(layer))
  })

  it.effect('sendWithOptOutCheck fails when number is opted out', () => {
    const { layer, publishCalls } = makeSnsTestLayer({ optedOut: true })
    return Effect.gen(function* () {
      const sms = yield* SMSService
      const err = yield* Effect.flip(
        sms.sendWithOptOutCheck({ phoneNumber: '+1999', message: 'nope' }),
      )
      assert.instanceOf(err, SMSServiceError)
      assert.match(err.message, /opted out/)
      assert.strictEqual(publishCalls.length, 0)
    }).pipe(Effect.provide(layer))
  })

  it.effect('sendWithOptOutCheck sends when not opted out', () => {
    const { layer, publishCalls } = makeSnsTestLayer({ optedOut: false })
    return Effect.gen(function* () {
      const sms = yield* SMSService
      const out = yield* sms.sendWithOptOutCheck({ phoneNumber: '+1888', message: 'yes' })
      assert.strictEqual(out.status, 'success')
      assert.strictEqual(publishCalls.length, 1)
    }).pipe(Effect.provide(layer))
  })
})
