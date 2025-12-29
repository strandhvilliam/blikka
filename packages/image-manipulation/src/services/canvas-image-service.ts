import { Effect, Schema } from "effect"

export class CanvasImageError extends Schema.TaggedError<CanvasImageError>()("CanvasImageError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export interface ResizeOptions {
  width: number
  quality?: number
  format?: "image/jpeg" | "image/png" | "image/webp"
}

export interface ResizedImage {
  blob: Blob
  width: number
  height: number
}

export class CanvasImageService extends Effect.Service<CanvasImageService>()(
  "@blikka/packages/image-manipulation/canvas-image-service",
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      if (typeof window === "undefined") {
        return yield* new CanvasImageError({
          message: "CanvasImageService is not supported in this environment",
        })
      }

      const resize = Effect.fn("CanvasImageService.resizeImage")(function* (
        file: File,
        options: ResizeOptions
      ) {
        const { width: targetWidth, quality = 0.9, format = "image/jpeg" } = options

        return Effect.async<ResizedImage, Error>((resume) => {
          const img = new Image()

          img.onload = () => {
            const aspectRatio = img.height / img.width
            const newWidth = targetWidth
            const newHeight = Math.round(targetWidth * aspectRatio)

            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")

            if (!ctx) {
              resume(
                Effect.fail(
                  new CanvasImageError({
                    message: "Failed to get canvas context",
                  })
                )
              )
              return
            }

            canvas.width = newWidth
            canvas.height = newHeight

            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = "high"

            ctx.drawImage(img, 0, 0, newWidth, newHeight)

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  resume(
                    Effect.fail(
                      new CanvasImageError({
                        message: "Failed to create blob from canvas",
                      })
                    )
                  )
                  return
                }

                resume(
                  Effect.succeed({
                    blob,
                    width: newWidth,
                    height: newHeight,
                  })
                )
              },
              format,
              quality
            )
          }

          img.onerror = () => {
            resume(
              Effect.fail(
                new CanvasImageError({
                  message: "Failed to load image",
                })
              )
            )
          }

          img.src = URL.createObjectURL(file)
        })
      })

      return {
        resize,
      } as const
    }),
  }
) {}
