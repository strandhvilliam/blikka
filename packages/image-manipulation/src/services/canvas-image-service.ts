import { Effect, Schema, Layer, Context } from 'effect'

export class CanvasImageError extends Schema.TaggedErrorClass<CanvasImageError>()(
  'CanvasImageError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export interface ResizeOptions {
  width: number
  quality?: number
  format?: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface ResizedImage {
  blob: Blob
  width: number
  height: number
}

export class CanvasImageService extends Context.Service<
  CanvasImageService,
  {
    /** Resize an image to a target width using the canvas API. */
    readonly resize: (
      file: File,
      options: ResizeOptions,
    ) => Effect.Effect<ResizedImage, CanvasImageError>
  }
>()('@blikka/packages/image-manipulation/canvas-image-service') {}

const makeCanvasImageService = Effect.gen(function* () {
  if (typeof window === 'undefined') {
    return yield* new CanvasImageError({
      message: 'CanvasImageService is not supported in this environment',
    })
  }

  const resize: CanvasImageService['Service']['resize'] = Effect.fn('CanvasImageService.resize')(
    function* (file: File, options: ResizeOptions) {
      const { width: targetWidth, quality = 0.9, format = 'image/jpeg' } = options

      return yield* Effect.callback<ResizedImage, CanvasImageError>((resume) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)
        const revoke = () => URL.revokeObjectURL(objectUrl)

        img.onload = () => {
          const aspectRatio = img.height / img.width
          const newWidth = targetWidth
          const newHeight = Math.round(targetWidth * aspectRatio)

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            revoke()
            resume(
              Effect.fail(
                new CanvasImageError({
                  message: 'Failed to get canvas context',
                }),
              ),
            )
            return
          }

          canvas.width = newWidth
          canvas.height = newHeight

          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'

          ctx.drawImage(img, 0, 0, newWidth, newHeight)

          canvas.toBlob(
            (blob) => {
              revoke()
              if (!blob) {
                resume(
                  Effect.fail(
                    new CanvasImageError({
                      message: 'Failed to create blob from canvas',
                    }),
                  ),
                )
                return
              }

              resume(
                Effect.succeed({
                  blob,
                  width: newWidth,
                  height: newHeight,
                }),
              )
            },
            format,
            quality,
          )
        }

        img.onerror = () => {
          revoke()
          resume(
            Effect.fail(
              new CanvasImageError({
                message: 'Failed to load image',
              }),
            ),
          )
        }

        img.src = objectUrl
      })
    },
  )

  return CanvasImageService.of({
    resize,
  })
})

export const CanvasImageServiceLayer = Layer.effect(CanvasImageService, makeCanvasImageService)
