import { Effect, Layer, Schema, Context } from 'effect'
import sharp from 'sharp'
import type { FailOnOptions, OverlayOptions } from 'sharp'
import { MAX_DECODE_INPUT_PIXELS } from '../constants'

/**
 * Why an image operation failed, so callers can tell a bad object apart from a bad moment.
 *
 * - `damaged-image` — the bytes are a recognised format but cannot be decoded (typically a
 *   truncated file: libvips reports `premature end of JPEG image`).
 * - `unsupported-format` — the bytes are not an image libvips can read at all.
 * - `pixel-limit` — decoded dimensions exceed {@link MAX_DECODE_INPUT_PIXELS}.
 * - `unknown` — anything else (S3, memory pressure, bugs); assume it may succeed on retry.
 */
export const SharpFailureReasonSchema = Schema.Literals([
  'damaged-image',
  'unsupported-format',
  'pixel-limit',
  'unknown',
])

export type SharpFailureReason = typeof SharpFailureReasonSchema.Type

export class SharpError extends Schema.TaggedErrorClass<SharpError>()('SharpError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  reason: Schema.optional(SharpFailureReasonSchema),
}) {}

/**
 * True when re-running the same bytes cannot succeed — the uploaded object itself is the
 * problem, so retrying (or alerting on infrastructure) is pointless.
 */
export function isPermanentImageFailure(reason: SharpFailureReason | undefined): boolean {
  return reason !== undefined && reason !== 'unknown'
}

/**
 * libvips reports decode problems as message text only, so classification is string based.
 * Patterns are matched case-insensitively and kept narrow: anything unrecognised stays
 * `unknown` so a transient failure is never mistaken for a damaged upload.
 */
const FAILURE_REASON_PATTERNS: ReadonlyArray<readonly [SharpFailureReason, string]> = [
  ['unsupported-format', 'unsupported image format'],
  ['pixel-limit', 'exceeds pixel limit'],
  ['damaged-image', 'premature end of'],
  ['damaged-image', 'corrupt'],
  ['damaged-image', 'not a jpeg file'],
  ['damaged-image', 'bogus'],
  ['damaged-image', 'bad huffman'],
]

function classifyFailureReason(error: unknown): SharpFailureReason {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()

  for (const [reason, pattern] of FAILURE_REASON_PATTERNS) {
    if (message.includes(pattern)) {
      return reason
    }
  }

  return 'unknown'
}

export interface SheetImagePart extends OverlayOptions {}

/**
 * A resized image plus the dimensions it actually came out at.
 *
 * `fit: 'inside'` does not pad, so the result is only as large as the source aspect ratio
 * allows. Callers that place the image on a canvas need the real dimensions to centre it —
 * assuming the requested box would push wide images past their cell.
 */
export interface PreparedImage {
  readonly buffer: Buffer
  readonly width: number
  readonly height: number
}

export class SharpImageService extends Context.Service<
  SharpImageService,
  {
    /** Resize an image to a target width using sharp. */
    readonly resize: (
      image: Uint8Array<ArrayBufferLike>,
      options: { width: number; height?: number; quality?: number },
    ) => Effect.Effect<Buffer, SharpError>
    /** Prepare an image for a canvas, returning the resized bytes and their real dimensions. */
    readonly prepareForCanvas: (
      buffer: Buffer,
      width: number,
      height: number,
      fit: 'cover' | 'inside',
      background: string,
    ) => Effect.Effect<PreparedImage, SharpError>
    /** Create a canvas sheet from a list of images. */
    readonly createCanvasSheet: (params: {
      width: number
      height: number
      background: string
      items: SheetImagePart[]
    }) => Effect.Effect<Buffer, SharpError>
  }
>()('@blikka/packages/image-manipulation/SharpImageService') {}

const makeSharpImageService = Effect.gen(function* () {
  const makeSharpImage = (image: Uint8Array<ArrayBufferLike>, failOn?: FailOnOptions) =>
    Effect.try({
      try: () =>
        sharp(image, {
          sequentialRead: true,
          limitInputPixels: MAX_DECODE_INPUT_PIXELS,
          ...(failOn ? { failOn } : {}),
        }),
      catch: (error) =>
        new SharpError({
          cause: error,
          message: 'Failed to create sharp instance',
          reason: classifyFailureReason(error),
        }),
    })

  const resize: SharpImageService['Service']['resize'] = Effect.fn('SharpImageService.resize')(
    function* (image, options) {
      const sharpImage = yield* makeSharpImage(image)

      const resized = yield* Effect.tryPromise({
        try: () =>
          sharpImage
            .rotate()
            .resize({
              width: options.width,
              height: options.height,
              withoutEnlargement: true,
              fit: 'inside',
            })
            .keepMetadata()
            .toBuffer(),
        catch: (error) =>
          new SharpError({
            cause: error,
            message: 'Failed to resize image',
            reason: classifyFailureReason(error),
          }),
      })
      return resized
    },
  )

  const prepareForCanvas: SharpImageService['Service']['prepareForCanvas'] = Effect.fn(
    'SharpImageService.prepareForCanvas',
  )(function* (buffer, width, height, fit, background) {
    const attemptDecode = (failOn?: FailOnOptions) =>
      Effect.gen(function* () {
        const sharpImage = yield* makeSharpImage(buffer, failOn)
        return yield* Effect.tryPromise({
          try: () =>
            sharpImage
              // Auto-orient first: EXIF orientation decides which of the source dimensions is
              // the width, so resizing before it would fit the wrong box (same order as
              // `resize` above).
              .rotate()
              .resize(width, height, {
                fit,
                withoutEnlargement: false,
                background,
              })
              .jpeg()
              .toBuffer({ resolveWithObject: true }),
          catch: (error) =>
            new SharpError({
              cause: error,
              message: 'Failed to prepare image for canvas',
              reason: classifyFailureReason(error),
            }),
        })
      })

    // `failOn` defaults to 'warning', which aborts on the first decode issue. A damaged upload
    // (e.g. a corrupt restart marker from a network-interrupted upload) doesn't have to sink the
    // whole contact sheet: retrying once with `failOn: 'none'` tells libvips to decode as much of
    // the image as it can instead of throwing, trading perfect fidelity in the damaged region for
    // a sheet that still builds.
    //
    // Retried on any decode failure, not just ones `classifyFailureReason` calls
    // `damaged-image` — libvips' text-only errors mean that classifier is necessarily incomplete
    // (e.g. a corrupted SOS byte reports as "Invalid SOS parameters", which matches none of its
    // patterns and falls to `unknown`). The lenient retry is a synchronous, local re-decode of
    // bytes already in memory, so an attempt that can't be salvaged (pixel limit, not an image,
    // genuinely truncated data) just fails again for negligible extra cost.
    const { data, info } = yield* attemptDecode().pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning(
            'Image failed strict decode; retrying leniently to salvage the contact sheet',
            { decodeError: error.message, reason: error.reason },
          )
          return yield* attemptDecode('none')
        }),
      ),
    )

    return { buffer: data, width: info.width, height: info.height }
  })

  const createCanvasSheet: SharpImageService['Service']['createCanvasSheet'] = Effect.fn(
    'SharpImageService.createCanvasSheet',
  )(function* ({ width, height, background, items }) {
    const canvas = yield* Effect.try({
      try: () =>
        sharp({
          create: {
            width,
            height,
            channels: 3,
            background,
          },
        }),
      catch: (error) =>
        new SharpError({
          cause: error,
          message: 'Failed to create canvas',
        }),
    })

    return yield* Effect.tryPromise({
      try: () => canvas.composite(items).jpeg().toBuffer(),
      catch: (error) =>
        new SharpError({
          cause: error,
          message: 'Failed to composite images',
          reason: classifyFailureReason(error),
        }),
    })
  })

  return SharpImageService.of({
    resize,
    prepareForCanvas,
    createCanvasSheet,
  })
})

export const SharpImageServiceLayer = Layer.effect(SharpImageService, makeSharpImageService)
