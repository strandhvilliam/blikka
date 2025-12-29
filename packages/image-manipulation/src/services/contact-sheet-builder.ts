import { Config, Effect, Option, Schema } from "effect"
import { SharpImageService } from "./sharp-image-service"
import { S3Service } from "@blikka/s3"
import {
  calculateCoordinateValues,
  calculateSheetVariables,
  generateParticipantReferenceSvg,
  generateTextLabelSvg,
  getGridConfig,
  getImageLabel,
  getImagePosition,
  parseKey,
} from "../utils"
import type { SponsorPosition, SheetVariables } from "../types"
import { CANVAS_HEIGHT, CANVAS_WIDTH, SEQUENCE_WIDTH_RATIO, WHITE_BACKGROUND } from "../constants"

export class InvalidSheetParamsError extends Schema.TaggedError<InvalidSheetParamsError>()(
  "InvalidSheetParamsError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class ContactSheetBuilder extends Effect.Service<ContactSheetBuilder>()(
  "@blikka/packages/image-manipulation/ContactSheetBuilder",
  {
    dependencies: [SharpImageService.Default, S3Service.Default],
    effect: Effect.gen(function* () {
      const sharp = yield* SharpImageService
      const s3 = yield* S3Service

      const submissionsBucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")
      const sponsorBucketName = yield* Config.string("SPONSOR_BUCKET_NAME")

      const getImageFiles = Effect.fn("SheetBuilder.getImageFiles")(function* (keys: string[]) {
        const results = yield* Effect.all(
          keys.map((key) =>
            Effect.gen(function* () {
              const buffer = yield* s3.getFile(submissionsBucketName, key)
              if (Option.isNone(buffer)) {
                return yield* new InvalidSheetParamsError({
                  message: "Image not found when processing",
                })
              }
              const parsedKey = yield* parseKey(key)
              return {
                ...parsedKey,
                key,
                buffer: buffer.value,
              }
            })
          ),
          { concurrency: 5 }
        )
        if (results.length !== keys.length) {
          return yield* new InvalidSheetParamsError({
            message: `Invalid image count. Expected ${keys.length}, got ${results.length}`,
          })
        }
        return results.sort((a, b) => Number(a.orderIndex) - Number(b.orderIndex))
      })

      const processSponsorImage = Effect.fn("SheetBuilder.processSponsorImage")(function* (
        sponsorFile: Buffer,
        sheetVariables: SheetVariables
      ) {
        return yield* sharp.prepareForCanvas(
          Buffer.from(sponsorFile),
          sheetVariables.cellWidth,
          sheetVariables.cellHeight,
          "inside",
          WHITE_BACKGROUND
        )
      })

      const processImage = Effect.fn("SheetBuilder.processImage")(function* (
        imageFile: Buffer,
        orderIndex: number,
        topics: { name: string; orderIndex: number }[],
        sheetVariables: SheetVariables
      ) {
        const image = yield* sharp.prepareForCanvas(
          Buffer.from(imageFile),
          sheetVariables.cellWidth,
          sheetVariables.cellHeight,
          "inside",
          WHITE_BACKGROUND
        )

        const textBuffer = yield* getImageLabel(orderIndex, topics).pipe(
          Effect.andThen(
            Option.match({
              onSome: (label) => Effect.succeed(label),
              onNone: () =>
                Effect.fail(
                  new InvalidSheetParamsError({
                    message: `Label not found (orderIndex: ${orderIndex})`,
                  })
                ),
            })
          ),
          Effect.andThen((label) =>
            generateTextLabelSvg({
              sheetVariables,
              label,
            })
          )
        )

        return {
          image,
          textBuffer,
        }
      })

      const createSheet = Effect.fn("SheetBuilder.createSheet")(function* ({
        domain,
        reference,
        keys,
        sponsorKey,
        sponsorPosition,
        topics,
      }: {
        domain: string
        reference: string
        keys: string[]
        sponsorKey?: string
        sponsorPosition: SponsorPosition
        topics: { name: string; orderIndex: number }[]
      }) {
        const imageFiles = yield* getImageFiles(keys)
        const sponsorFile = sponsorKey
          ? yield* s3.getFile(sponsorBucketName, sponsorKey)
          : Option.none<Uint8Array>()

        const { cols, rows, sponsorRow, sponsorCol } = getGridConfig(
          sponsorPosition,
          imageFiles.length
        )
        const sheetVariables = calculateSheetVariables(reference, cols, rows)

        const cellPositions = Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => ({ row, col }))
        ).flat()

        const compositeImages = yield* Effect.forEach(
          cellPositions,
          ({ row, col }, index) =>
            Effect.gen(function* () {
              const { x, y } = calculateCoordinateValues({
                col,
                row,
                sheetVariables,
              })
              const imagePosition = getImagePosition({ x, y, sheetVariables })
              const isSponsor = row === sponsorRow && col === sponsorCol && sponsorFile

              if (isSponsor && Option.isSome(sponsorFile)) {
                return yield* processSponsorImage(
                  Buffer.from(sponsorFile.value),
                  sheetVariables
                ).pipe(Effect.map((sponsorImage) => [{ input: sponsorImage, ...imagePosition }]))
              }

              if (index < imageFiles.length) {
                const file = imageFiles[index]
                if (!file) {
                  return yield* Effect.fail(
                    new InvalidSheetParamsError({
                      message: "Image not found when processing",
                    })
                  )
                }
                return yield* processImage(
                  Buffer.from(file.buffer),
                  index,
                  topics,
                  sheetVariables
                ).pipe(
                  Effect.map(({ image, textBuffer }) => [
                    { input: image, ...imagePosition },
                    {
                      input: textBuffer,
                      top: y + sheetVariables.availableImageHeight,
                      left: x,
                    },
                  ])
                )
              }

              return yield* Effect.succeed<{ input: Buffer; top: number; left: number }[]>([])
            }),
          { concurrency: 8 }
        ).pipe(Effect.map((data) => data.flat()))

        const participantReferenceSvg = yield* generateParticipantReferenceSvg({
          reference,
        })
        const seqWidth = Math.floor(CANVAS_WIDTH * SEQUENCE_WIDTH_RATIO)
        const seqHeight = Math.floor(CANVAS_HEIGHT)
        const participantReferenceCompositePart = {
          input: participantReferenceSvg,
          top: CANVAS_HEIGHT - seqHeight,
          left: CANVAS_WIDTH - seqWidth,
        }

        const finalSheet = yield* sharp.createCanvasSheet({
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          background: WHITE_BACKGROUND,
          items: [...compositeImages, participantReferenceCompositePart],
        })

        return finalSheet
      })

      return {
        createSheet,
      } as const
    }),
  }
) {}
