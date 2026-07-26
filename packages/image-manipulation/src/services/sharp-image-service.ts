import { Effect, Layer, Schema, Context } from 'effect'
import sharp from 'sharp'
import type { OverlayOptions } from 'sharp'
import { MAX_DECODE_INPUT_PIXELS } from '../constants'

export class SharpError extends Schema.TaggedErrorClass<SharpError>()('SharpError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

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
  const makeSharpImage = (image: Uint8Array<ArrayBufferLike>) =>
    Effect.try({
      try: () =>
        sharp(image, {
          sequentialRead: true,
          limitInputPixels: MAX_DECODE_INPUT_PIXELS,
        }),
      catch: (error) =>
        new SharpError({
          cause: error,
          message: 'Failed to create sharp instance',
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
          }),
      })
      return resized
    },
  )

  const prepareForCanvas: SharpImageService['Service']['prepareForCanvas'] = Effect.fn(
    'SharpImageService.prepareForCanvas',
  )(function* (buffer, width, height, fit, background) {
    const sharpImage = yield* makeSharpImage(buffer)
    const { data, info } = yield* Effect.tryPromise({
      try: () =>
        sharpImage
          // Auto-orient first: EXIF orientation decides which of the source dimensions is the
          // width, so resizing before it would fit the wrong box (same order as `resize` above).
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
        }),
    })

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
