import { Effect, Layer, Schema, ServiceMap } from "effect"
import sharp from "sharp"
import type { OverlayOptions } from "sharp"

export class SharpError extends Schema.TaggedErrorClass<SharpError>()("SharpError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export interface SheetImagePart extends OverlayOptions { }

const makeSharpImage = (image: Buffer) =>
  Effect.try({
    try: () => sharp(image),
    catch: (error) =>
      new SharpError({
        cause: error,
        message: "Failed to create sharp instance",
      }),
  })

export class SharpImageService extends ServiceMap.Service<SharpImageService>()(
  "@blikka/packages/image-manipulation/SharpImageService",
  {
    make: Effect.gen(function* () {
      const resize = Effect.fn("SharpImageService.resize")(function* (
        image: Buffer,
        options: { width: number; height?: number; quality?: number }
      ) {
        const sharpImage = yield* makeSharpImage(image)

        const resized = yield* Effect.tryPromise({
          try: () =>
            sharpImage
              .rotate()
              .resize({
                width: options.width,
                height: options.height,
                withoutEnlargement: true,
                fit: "inside",
              })
              .keepMetadata()
              .toBuffer(),
          catch: (error) =>
            new SharpError({
              cause: error,
              message: "Failed to resize image",
            }),
        })
        return resized
      })

      const prepareForCanvas = Effect.fn("SharpImageService.prepareForCanvas")(function* (
        buffer: Buffer,
        width: number,
        height: number,
        fit: "cover" | "inside",
        background: string
      ) {
        const sharpImage = yield* makeSharpImage(buffer)
        return yield* Effect.tryPromise({
          try: () =>
            sharpImage
              .resize(width, height, {
                fit,
                withoutEnlargement: false,
                background,
              })
              .jpeg()
              .rotate()
              .toBuffer(),
          catch: (error) =>
            new SharpError({
              cause: error,
              message: "Failed to prepare image for canvas",
            }),
        })
      })

      const createCanvasSheet = Effect.fn("SharpImageService.createCanvasSheet")(function* ({
        width,
        height,
        background,
        items,
      }: {
        width: number
        height: number
        background: string
        items: SheetImagePart[]
      }) {
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
              message: "Failed to create canvas",
            }),
        })

        return yield* Effect.tryPromise({
          try: () => canvas.composite(items).jpeg().toBuffer(),
          catch: (error) =>
            new SharpError({
              cause: error,
              message: "Failed to composite images",
            }),
        })
      })

      return {
        resize,
        prepareForCanvas,
        createCanvasSheet,
      } as const
    }),
  }
) {

  static readonly layer = Layer.effect(this, this.make)
}
