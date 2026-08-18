import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'

import {
  isPermanentImageFailure,
  SharpImageService,
  SharpImageServiceLayer,
} from './sharp-image-service'

/** 8x8 JPEG, no metadata. Small enough to inline, real enough for libvips to decode. */
const JPEG = Buffer.from(
  '/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCIBQDf/9k=',
  'base64',
)

/** Cut short mid-scan, the way a half-copied card or interrupted export arrives. */
const TRUNCATED_JPEG = JPEG.subarray(0, Math.floor(JPEG.length * 0.7))

/**
 * A single flipped bit in the SOS (start-of-scan) header, the way a bit-level transfer glitch
 * arrives — the file is complete, just wrong partway through. Strict decode rejects it
 * ("Invalid SOS parameters"); lenient decode (`failOn: 'none'`) can still salvage an image from it.
 */
function corruptScanByte(jpeg: Buffer): Buffer {
  const sosMarker = jpeg.indexOf(Buffer.from([0xff, 0xda]))
  if (sosMarker === -1) throw new Error('Fixture JPEG has no SOS marker')

  const corrupted = Buffer.from(jpeg)
  const scanParamByte = sosMarker + 12
  corrupted[scanParamByte] = (corrupted[scanParamByte] ?? 0) ^ 0b1
  return corrupted
}

const CORRUPT_SCAN_JPEG = corruptScanByte(JPEG)

describe('SharpImageService.resize', () => {
  it.effect('resizes a valid JPEG', () =>
    Effect.gen(function* () {
      const sharp = yield* SharpImageService
      const resized = yield* sharp.resize(JPEG, { width: 4 })

      assert.isAbove(resized.byteLength, 0)
    }).pipe(Effect.provide(SharpImageServiceLayer)),
  )

  // Guards the message patterns the classifier matches on: libvips only reports decode
  // problems as text, so a wording change upstream silently degrades this to 'unknown'.
  it.effect('classifies a truncated JPEG as a damaged image', () =>
    Effect.gen(function* () {
      const sharp = yield* SharpImageService
      const error = yield* Effect.flip(sharp.resize(TRUNCATED_JPEG, { width: 4 }))

      assert.strictEqual(error.reason, 'damaged-image')
      assert.isTrue(isPermanentImageFailure(error.reason))
    }).pipe(Effect.provide(SharpImageServiceLayer)),
  )

  it.effect('classifies non-image bytes as an unsupported format', () =>
    Effect.gen(function* () {
      const sharp = yield* SharpImageService
      const error = yield* Effect.flip(sharp.resize(Buffer.from('not an image'), { width: 4 }))

      assert.strictEqual(error.reason, 'unsupported-format')
      assert.isTrue(isPermanentImageFailure(error.reason))
    }).pipe(Effect.provide(SharpImageServiceLayer)),
  )
})

describe('SharpImageService.prepareForCanvas', () => {
  it.effect('prepares a valid JPEG', () =>
    Effect.gen(function* () {
      const sharp = yield* SharpImageService
      const prepared = yield* sharp.prepareForCanvas(JPEG, 4, 4, 'inside', '#ffffff')

      assert.isAbove(prepared.buffer.byteLength, 0)
      assert.isAbove(prepared.width, 0)
      assert.isAbove(prepared.height, 0)
    }).pipe(Effect.provide(SharpImageServiceLayer)),
  )

  it.effect('salvages a JPEG whose strict decode fails by retrying with failOn: none', () =>
    Effect.gen(function* () {
      const sharp = yield* SharpImageService

      // Confirms the fixture actually exercises the fallback: strict decode alone rejects it.
      const strictError = yield* Effect.flip(sharp.resize(CORRUPT_SCAN_JPEG, { width: 4 }))
      assert.include(String(strictError.cause).toLowerCase(), 'sos')

      const prepared = yield* sharp.prepareForCanvas(CORRUPT_SCAN_JPEG, 4, 4, 'inside', '#ffffff')
      assert.isAbove(prepared.buffer.byteLength, 0)
    }).pipe(Effect.provide(SharpImageServiceLayer)),
  )

  it.effect('still fails on a genuinely truncated JPEG the lenient retry cannot salvage', () =>
    Effect.gen(function* () {
      const sharp = yield* SharpImageService
      const error = yield* Effect.flip(
        sharp.prepareForCanvas(TRUNCATED_JPEG, 4, 4, 'inside', '#ffffff'),
      )

      assert.strictEqual(error._tag, 'SharpError')
    }).pipe(Effect.provide(SharpImageServiceLayer)),
  )
})

describe('isPermanentImageFailure', () => {
  it('treats unclassified failures as retryable', () => {
    assert.isFalse(isPermanentImageFailure('unknown'))
    assert.isFalse(isPermanentImageFailure(undefined))
  })

  it('treats decode failures as permanent', () => {
    assert.isTrue(isPermanentImageFailure('damaged-image'))
    assert.isTrue(isPermanentImageFailure('unsupported-format'))
    assert.isTrue(isPermanentImageFailure('pixel-limit'))
  })
})
