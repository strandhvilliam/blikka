import type { SheetVariables, SponsorPosition } from "./types"
import { Array, Effect, Option, Schema } from "effect"
import {
  SMALL_IMAGE_COUNT,
  SMALL_GRID_SIZE,
  LARGE_GRID_SIZE,
  BOTTOM_ROW_SMALL,
  BOTTOM_ROW_LARGE,
  LEFT_COL,
  TOP_ROW,
  RIGHT_COL_SMALL,
  RIGHT_COL_LARGE,
  MIDDLE_ROW,
  CENTER_ROW_LARGE,
  MIDDLE_COL,
  CENTER_COL_LARGE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_PADDING,
  EXTRA_SPACING_ADJUSTMENT,
  IMAGE_SIZE_FACTOR,
  LABEL_FONT_SIZE,
  LABEL_INDEX_OFFSET,
  LANDSCAPE_ASPECT_RATIO,
  SEQUENCE_BOTTOM_MARGIN,
  SEQUENCE_FONT_SIZE_MIN,
  SEQUENCE_FONT_SIZE_RATIO,
  SEQUENCE_SPACE_RATIO,
  SEQUENCE_WIDTH_RATIO,
  TEXT_HEIGHT_RATIO,
  TEXT_SPACING_REDUCTION,
  TEXT_VERTICAL_POSITION,
  ROW_SPACING,
} from "./constants"

export class InvalidKeyFormatError extends Schema.TaggedError<InvalidKeyFormatError>()(
  "InvalidKeyFormatError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class SvgGenerationError extends Schema.TaggedError<SvgGenerationError>()(
  "SvgGenerationError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const parseKey = (key: string) =>
  Effect.sync(() => {
    const [domain, reference, orderIndex, fileName] = key.split("/")
    if (!domain || !reference || !orderIndex || !fileName) {
      return Effect.fail(
        new InvalidKeyFormatError({
          message: `Missing: domain=${domain}, reference=${reference}, orderIndex=${orderIndex}, fileName=${fileName}`,
        })
      )
    }
    return Effect.succeed({ domain, reference, orderIndex, fileName })
  }).pipe(Effect.flatten)

export function getGridConfig(sponsorPosition: SponsorPosition, imageCount: number) {
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

export function escapeXml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function getSponsorPosition(
  position: SponsorPosition,
  isSmallGrid: boolean
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
  }

  return positions[position]
}

export function calculateSheetVariables(
  reference: string,
  cols: number,
  rows: number
): SheetVariables {
  const textHeight = Math.round(CANVAS_HEIGHT * TEXT_HEIGHT_RATIO)
  const sequenceSpace = reference ? Math.round(CANVAS_HEIGHT * SEQUENCE_SPACE_RATIO) : 0

  const availableWidth = CANVAS_WIDTH - DEFAULT_PADDING * (cols + 1)
  const availableHeight =
    CANVAS_HEIGHT - DEFAULT_PADDING * (rows + 1) - sequenceSpace + EXTRA_SPACING_ADJUSTMENT

  const cellWidth = Math.floor(availableWidth / cols)
  const cellHeight = Math.floor(availableHeight / rows)

  const availableImageHeight = cellHeight - (textHeight - TEXT_SPACING_REDUCTION)

  let imageWidth: number, imageHeight: number
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

export const getImageLabel = Effect.fnUntraced(function* (
  orderIndex: number,
  topics: { name: string; orderIndex: number }[]
) {
  const topic = yield* Array.findFirst(topics, (t) => t.orderIndex === orderIndex)
  if (!topic) return Option.none()
  return Option.some(`${topic.orderIndex + LABEL_INDEX_OFFSET} - ${topic.name}`)
})

export function calculateImagePosition({
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

export function getImagePosition({
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

export function calculateCoordinateValues({
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

export const generateParticipantReferenceSvg = ({ reference }: { reference: string }) =>
  Effect.try({
    try: () => {
      const seqFontSize = Math.max(
        SEQUENCE_FONT_SIZE_MIN,
        Math.floor(CANVAS_HEIGHT * SEQUENCE_FONT_SIZE_RATIO)
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
    },
    catch: (error) =>
      new SvgGenerationError({
        cause: error,
        message: "Failed to generate participant reference SVG",
      }),
  })

export const generateTextLabelSvg = ({
  label,
  sheetVariables,
}: {
  label: string
  sheetVariables: SheetVariables
}) =>
  Effect.try({
    try: () => {
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
    },
    catch: (error) =>
      new SvgGenerationError({
        cause: error,
        message: "Failed to generate text label SVG",
      }),
  })
