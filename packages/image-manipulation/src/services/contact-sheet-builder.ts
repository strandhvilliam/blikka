import { Effect, Layer, Schema, Context } from "effect"
import { SharpImageService, SharpImageServiceLayer } from "./sharp-image-service"
import type { SponsorPosition, SheetVariables } from "../types"
import type { SharpError } from "./sharp-image-service"

const CANVAS_WIDTH = 3986
const CANVAS_HEIGHT = 2657
const LANDSCAPE_ASPECT_RATIO = 3 / 2
const DEFAULT_PADDING = 30

const SMALL_GRID_SIZE = 3
const LARGE_GRID_SIZE = 5
const SMALL_IMAGE_COUNT = 8
const LARGE_IMAGE_COUNT = 24

const TOP_ROW = 0
const MIDDLE_ROW = 1
const BOTTOM_ROW_SMALL = 2
const CENTER_ROW_LARGE = 2
const BOTTOM_ROW_LARGE = 4
const LEFT_COL = 0
const MIDDLE_COL = 1
const RIGHT_COL_SMALL = 2
const CENTER_COL_LARGE = 2
const RIGHT_COL_LARGE = 4

const ROW_SPACING = 10
const EXTRA_SPACING_ADJUSTMENT = 12
const TEXT_SPACING_REDUCTION = 32
const TEXT_TOP_GAP = 4
const IMAGE_SIZE_FACTOR = 0.99
const SEQUENCE_BOTTOM_MARGIN = 32

const TEXT_HEIGHT_RATIO = 0.025
const SEQUENCE_SPACE_RATIO = 0.04
const LABEL_FONT_SIZE = 28
const SEQUENCE_FONT_SIZE_MIN = 32
const SEQUENCE_FONT_SIZE_RATIO = 0.05
const SEQUENCE_WIDTH_RATIO = 0.12
const TEXT_VERTICAL_POSITION = 0.45
const LABEL_INDEX_OFFSET = 1

const WHITE_BACKGROUND = "#ffffff"

export class InvalidSheetParamsError extends Schema.TaggedErrorClass<InvalidSheetParamsError>()(
  "InvalidSheetParamsError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ContactSheetBuildError extends Schema.TaggedErrorClass<ContactSheetBuildError>()(
  "ContactSheetBuildError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export interface ContactSheetImageFile {
  readonly orderIndex: number
  readonly buffer: Buffer | Uint8Array
}

interface CreateSheetParams {
  reference: string
  images: ReadonlyArray<ContactSheetImageFile>
  sponsorImage?: Buffer | Uint8Array
  sponsorPosition: SponsorPosition
  topics: ReadonlyArray<{ name: string; orderIndex: number }>
}

export type ContactSheetError = InvalidSheetParamsError | ContactSheetBuildError

interface CompositeImage {
  input: Buffer
  top: number
  left: number
}

function getSponsorPosition(
  position: SponsorPosition,
  isSmallGrid: boolean,
): { row: number; col: number } {
  const positions = {
    "bottom-left": {
      row: isSmallGrid ? BOTTOM_ROW_SMALL : BOTTOM_ROW_LARGE,
      col: LEFT_COL,
    },
    "top-right": {
      row: TOP_ROW,
      col: isSmallGrid ? RIGHT_COL_SMALL : RIGHT_COL_LARGE,
    },
    "top-left": {
      row: TOP_ROW,
      col: LEFT_COL,
    },
    center: {
      row: isSmallGrid ? MIDDLE_ROW : CENTER_ROW_LARGE,
      col: isSmallGrid ? MIDDLE_COL : CENTER_COL_LARGE,
    },
    "bottom-right": {
      row: isSmallGrid ? BOTTOM_ROW_SMALL : BOTTOM_ROW_LARGE,
      col: isSmallGrid ? RIGHT_COL_SMALL : RIGHT_COL_LARGE,
    },
  } satisfies Record<SponsorPosition, { row: number; col: number }>

  return positions[position]
}

function getGridConfig(sponsorPosition: SponsorPosition, imageCount: number) {
  const isSmallGrid = imageCount === SMALL_IMAGE_COUNT
  const gridSize = isSmallGrid ? SMALL_GRID_SIZE : LARGE_GRID_SIZE
  const { row: sponsorRow, col: sponsorCol } = getSponsorPosition(sponsorPosition, isSmallGrid)

  return {
    cols: gridSize,
    rows: gridSize,
    sponsorRow,
    sponsorCol,
  }
}

function escapeXml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function calculateSheetVariables(reference: string, cols: number, rows: number): SheetVariables {
  const textHeight = Math.round(CANVAS_HEIGHT * TEXT_HEIGHT_RATIO)
  const sequenceSpace = reference ? Math.round(CANVAS_HEIGHT * SEQUENCE_SPACE_RATIO) : 0

  const availableWidth = CANVAS_WIDTH - DEFAULT_PADDING * (cols + 1)
  const availableHeight =
    CANVAS_HEIGHT - DEFAULT_PADDING * (rows + 1) - sequenceSpace + EXTRA_SPACING_ADJUSTMENT

  const cellWidth = Math.floor(availableWidth / cols)
  const cellHeight = Math.floor(availableHeight / rows)
  const availableImageHeight = cellHeight - (textHeight - TEXT_SPACING_REDUCTION)

  let imageWidth: number
  let imageHeight: number
  if (cellWidth / availableImageHeight > LANDSCAPE_ASPECT_RATIO) {
    imageHeight = Math.floor(availableImageHeight * IMAGE_SIZE_FACTOR)
    imageWidth = Math.floor(imageHeight * LANDSCAPE_ASPECT_RATIO)
  } else {
    imageWidth = Math.floor(cellWidth * IMAGE_SIZE_FACTOR)
    imageHeight = Math.floor(imageWidth / LANDSCAPE_ASPECT_RATIO)
  }

  return {
    cellWidth,
    cellHeight,
    availableImageHeight,
    imageWidth,
    imageHeight,
    textHeight,
    sequenceSpace,
    availableWidth,
    availableHeight,
  }
}

function getImageLabel(
  orderIndex: number,
  topics: ReadonlyArray<{ name: string; orderIndex: number }>,
) {
  const topic = topics.find((t) => t.orderIndex === orderIndex)
  return topic ? `${topic.orderIndex + LABEL_INDEX_OFFSET} - ${topic.name}` : undefined
}

function getImagePosition({
  x,
  y,
  sheetVariables,
}: {
  x: number
  y: number
  sheetVariables: SheetVariables
}) {
  return {
    top: y + Math.floor((sheetVariables.availableImageHeight - sheetVariables.imageHeight) / 2),
    left: x + Math.floor((sheetVariables.cellWidth - sheetVariables.imageWidth) / 2),
  }
}

function calculateCoordinateValues({
  col,
  row,
  sheetVariables,
}: {
  col: number
  row: number
  sheetVariables: SheetVariables
}) {
  return {
    x: DEFAULT_PADDING + col * (sheetVariables.cellWidth + DEFAULT_PADDING),
    y: DEFAULT_PADDING * 2 + row * (sheetVariables.cellHeight + ROW_SPACING),
  }
}

function getCellPositions(rows: number, cols: number) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({ row, col })),
  ).flat()
}

function getParticipantReferenceCompositePart(participantReferenceSvg: Buffer): CompositeImage {
  const seqWidth = Math.floor(CANVAS_WIDTH * SEQUENCE_WIDTH_RATIO)
  const seqHeight = Math.floor(CANVAS_HEIGHT)

  return {
    input: participantReferenceSvg,
    top: CANVAS_HEIGHT - seqHeight,
    left: CANVAS_WIDTH - seqWidth,
  }
}

function generateParticipantReferenceSvg({ reference }: { reference: string }) {
  const seqFontSize = Math.max(
    SEQUENCE_FONT_SIZE_MIN,
    Math.floor(CANVAS_HEIGHT * SEQUENCE_FONT_SIZE_RATIO),
  )
  const seqWidth = Math.floor(CANVAS_WIDTH * SEQUENCE_WIDTH_RATIO)
  const seqHeight = Math.floor(CANVAS_HEIGHT)

  const seqSvg = `
      <svg width="${seqWidth}" height="${seqHeight}">
        <text x="${seqWidth / 2}" y="${seqHeight - SEQUENCE_BOTTOM_MARGIN}" 
              font-family="Arial, sans-serif" 
              font-size="${seqFontSize}" 
              font-weight="bold"
              fill="black" 
              text-anchor="middle">${escapeXml(reference)}</text>
      </svg>
    `
  return Buffer.from(seqSvg)
}

function generateTextLabelSvg({
  label,
  sheetVariables,
}: {
  label: string
  sheetVariables: SheetVariables
}) {
  const textSvg = `
        <svg width="${sheetVariables.cellWidth}" height="${sheetVariables.textHeight}">
          <text x="${Math.floor((sheetVariables.cellWidth - sheetVariables.imageWidth) / 2)}" y="${sheetVariables.textHeight * TEXT_VERTICAL_POSITION}" 
                font-family="Arial, sans-serif" 
                font-size="${LABEL_FONT_SIZE}" 
                font-weight="medium"
                fill="black" 
                text-anchor="start"
                >${escapeXml(label)}</text>
        </svg>
      `
  return Buffer.from(textSvg)
}

export class ContactSheetBuilder extends Context.Service<
  ContactSheetBuilder,
  {
    /** Create a contact sheet from a list of image files. */
    readonly createSheet: (params: CreateSheetParams) => Effect.Effect<Buffer, ContactSheetError>
  }
>()("@blikka/packages/image-manipulation/ContactSheetBuilder") {}

const makeContactSheetBuilder = Effect.gen(function* () {
  const sharp = yield* SharpImageService

  const validateAndSortImageFiles = Effect.fn("ContactSheetBuilder.validateAndSortImageFiles")(
    function* (images: ReadonlyArray<ContactSheetImageFile>) {
      if (images.length !== SMALL_IMAGE_COUNT && images.length !== LARGE_IMAGE_COUNT) {
        return yield* new InvalidSheetParamsError({
          message: `Invalid image count. Expected 8 or 24, got ${images.length}`,
        })
      }

      return [...images].sort((a, b) => a.orderIndex - b.orderIndex)
    },
  )

  const processSponsorImage = Effect.fn("ContactSheetBuilder.processSponsorImage")(function* (
    sponsorFile: Buffer,
    sheetVariables: SheetVariables,
  ) {
    return yield* sharp.prepareForCanvas(
      Buffer.from(sponsorFile),
      sheetVariables.cellWidth,
      sheetVariables.cellHeight,
      "inside",
      WHITE_BACKGROUND,
    )
  })

  const processImage = Effect.fn("ContactSheetBuilder.processImage")(function* (
    imageFile: Buffer,
    orderIndex: number,
    topics: ReadonlyArray<{ name: string; orderIndex: number }>,
    sheetVariables: SheetVariables,
  ) {
    const image = yield* sharp.prepareForCanvas(
      Buffer.from(imageFile),
      sheetVariables.cellWidth,
      sheetVariables.availableImageHeight,
      "inside",
      WHITE_BACKGROUND,
    )

    const label = getImageLabel(orderIndex, topics)
    if (!label) {
      return yield* new InvalidSheetParamsError({
        message: `Label not found (orderIndex: ${orderIndex})`,
      })
    }

    const textBuffer = generateTextLabelSvg({
      sheetVariables,
      label,
    })

    return {
      image,
      textBuffer,
    }
  })

  const createSheet: ContactSheetBuilder["Service"]["createSheet"] = Effect.fn(
    "ContactSheetBuilder.createSheet",
  )(
    function* (params: CreateSheetParams) {
      const { reference, images, sponsorImage, sponsorPosition, topics } = params

      const imageFiles = yield* validateAndSortImageFiles(images)

      const { cols, rows, sponsorRow, sponsorCol } = getGridConfig(
        sponsorPosition,
        imageFiles.length,
      )
      const sheetVariables = calculateSheetVariables(reference, cols, rows)

      const cellPositions = getCellPositions(rows, cols)
      let nextImageIndex = 0
      const positionedCells = cellPositions.map(({ row, col }) => {
        const isSponsor = row === sponsorRow && col === sponsorCol && sponsorImage
        const imageIndex = isSponsor ? undefined : nextImageIndex++

        return { row, col, imageIndex, isSponsor }
      })

      const compositeImages = yield* Effect.forEach(
        positionedCells,
        ({ row, col, imageIndex, isSponsor }) =>
          Effect.gen(function* () {
            const { x, y } = calculateCoordinateValues({
              col,
              row,
              sheetVariables,
            })
            const imagePosition = getImagePosition({
              x,
              y,
              sheetVariables,
            })

            if (isSponsor) {
              if (!sponsorImage) {
                return yield* Effect.fail(
                  new InvalidSheetParamsError({
                    message: "Sponsor image not found",
                  }),
                )
              }
              const preparedSponsorImage = yield* processSponsorImage(
                Buffer.from(sponsorImage),
                sheetVariables,
              )
              return [{ input: preparedSponsorImage, ...imagePosition }]
            }

            if (imageIndex !== undefined && imageIndex < imageFiles.length) {
              const file = imageFiles[imageIndex]
              if (!file) {
                return yield* Effect.fail(
                  new InvalidSheetParamsError({
                    message: "Image not found when processing",
                  }),
                )
              }
              const { image, textBuffer } = yield* processImage(
                Buffer.from(file.buffer),
                file.orderIndex,
                topics,
                sheetVariables,
              )
              return [
                { input: image, ...imagePosition },
                {
                  input: textBuffer,
                  top: y + sheetVariables.availableImageHeight + TEXT_TOP_GAP,
                  left: x,
                },
              ]
            }

            return []
          }),
        { concurrency: 8 },
      ).pipe(Effect.map((data) => data.flat()))

      const participantReferenceSvg = generateParticipantReferenceSvg({
        reference,
      })
      const participantReferenceCompositePart =
        getParticipantReferenceCompositePart(participantReferenceSvg)

      const finalSheet = yield* sharp.createCanvasSheet({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        background: WHITE_BACKGROUND,
        items: [...compositeImages, participantReferenceCompositePart],
      })

      return finalSheet
    },
    Effect.catchTags({
      SharpError: (e: SharpError) =>
        Effect.fail(
          new ContactSheetBuildError({
            message: e.message,
            cause: e,
          }),
        ),
    }),
  )
  return ContactSheetBuilder.of({
    createSheet,
  })
})

export const ContactSheetBuilderLayerNoDeps = Layer.effect(
  ContactSheetBuilder,
  makeContactSheetBuilder,
)

export const ContactSheetBuilderLayer = ContactSheetBuilderLayerNoDeps.pipe(
  Layer.provide(SharpImageServiceLayer),
)
