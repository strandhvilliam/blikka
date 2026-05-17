import { assert, describe, it } from '@effect/vitest'
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { Effect, Layer, Option } from 'effect'
import { afterEach, beforeEach, vi } from 'vitest'

import { S3EffectClient } from './clients/s3-effect-client'
import {
  createSubmissionObjectKey,
  resolveSubmissionContentType,
  resolveSubmissionExtension,
  S3Service,
  S3ServiceLayerNoDeps,
} from './s3-service'

describe('resolveSubmissionContentType', () => {
  it('defaults to image/jpeg when missing or unknown', () => {
    assert.strictEqual(resolveSubmissionContentType(), 'image/jpeg')
    assert.strictEqual(resolveSubmissionContentType(undefined), 'image/jpeg')
    assert.strictEqual(resolveSubmissionContentType('application/pdf'), 'image/jpeg')
  })

  it('accepts mapped submission content types', () => {
    assert.strictEqual(resolveSubmissionContentType('image/png'), 'image/png')
    assert.strictEqual(resolveSubmissionContentType('image/webp'), 'image/webp')
  })
})

describe('resolveSubmissionExtension', () => {
  it('matches resolved content types', () => {
    assert.strictEqual(resolveSubmissionExtension(), 'jpg')
    assert.strictEqual(resolveSubmissionExtension('image/png'), 'png')
    assert.strictEqual(resolveSubmissionExtension('image/heif'), 'heif')
  })
})

describe('createSubmissionObjectKey', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-02T08:30:45.123Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats path, padded index, sanitized timestamp and extension', () => {
    const key = createSubmissionObjectKey({
      domain: 'marathon-demo',
      reference: 'ABC12',
      orderIndex: 2,
      contentType: 'image/png',
    })
    assert.strictEqual(key, 'marathon-demo/ABC12/03/ABC12_03_2026-03-02T08-30-45-123Z.png')
  })

  it('includes filename prefix when provided', () => {
    const key = createSubmissionObjectKey({
      domain: 'x',
      reference: 'Y',
      orderIndex: 0,
      filenamePrefix: 'pre',
      contentType: 'image/gif',
    })
    assert.strictEqual(key, 'x/Y/01/pre_Y_01_2026-03-02T08-30-45-123Z.gif')
  })
})

describe('S3Service (with fake S3EffectClient)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-02T08:30:45.123Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const makeTestLayer = (body: { transformToByteArray: () => Promise<Uint8Array> } | undefined) => {
    const fakeClient = {
      send: (command: unknown) => {
        if (command instanceof GetObjectCommand) {
          return Promise.resolve({ Body: body })
        }
        return Promise.reject(new Error(`Unexpected command: ${String(command)}`))
      },
    } as unknown as S3Client

    const fakeS3Effect = S3EffectClient.of({
      use: (fn) =>
        Effect.gen(function* () {
          const result = fn(fakeClient)
          if (result instanceof Promise) {
            return yield* Effect.promise(() => result)
          }
          return result
        }),
    })

    return S3ServiceLayerNoDeps.pipe(Layer.provide(Layer.succeed(S3EffectClient)(fakeS3Effect)))
  }

  it.effect('getFile returns none when Body is missing', () =>
    Effect.gen(function* () {
      const svc = yield* S3Service
      const out = yield* svc.getFile('b', 'k')
      assert.deepStrictEqual(out, Option.none())
    }).pipe(Effect.provide(makeTestLayer(undefined))),
  )

  it.effect('getFile returns bytes when Body transforms', () => {
    const bytes = Uint8Array.from([9, 8, 7])
    return Effect.gen(function* () {
      const svc = yield* S3Service
      const out = yield* svc.getFile('buck', 'key')
      assert.ok(Option.isSome(out))
      assert.deepStrictEqual([...Option.getOrThrow(out)], [...bytes])
    }).pipe(
      Effect.provide(
        makeTestLayer({
          transformToByteArray: () => Promise.resolve(bytes),
        }),
      ),
    )
  })

  it.effect('generateSubmissionKey delegates to path helper', () =>
    Effect.gen(function* () {
      const svc = yield* S3Service
      const key = yield* svc.generateSubmissionKey('d', 'R', 1, {
        filenamePrefix: 'p',
        contentType: 'image/jpeg',
      })
      assert.strictEqual(key, 'd/R/02/p_R_02_2026-03-02T08-30-45-123Z.jpg')
    }).pipe(Effect.provide(makeTestLayer(undefined))),
  )
})
