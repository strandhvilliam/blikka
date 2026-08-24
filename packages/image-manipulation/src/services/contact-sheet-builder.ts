import { Effect, Layer, Schema, Context } from 'effect'
import { bundledFontsError, installBundledFonts } from './bundled-fonts'
import { SharpImageService, SharpImageServiceLayer } from './sharp-image-service'
import type { SponsorPosition, SheetVariables } from '../types'
import type { SharpError } from './sharp-image-service'

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

const LABEL_INDEX_OFFSET = 1

/** Multiplied by `labelFontSize` — footnotes share the caption's type size and scale with it. */
const FOOTNOTE_LINE_HEIGHT_FACTOR = 1.35

const FOOTNOTE_MARKER = '*'

/** Glosses are short and the margin is wide; two columns halve the height the block needs. */
const FOOTNOTE_COLUMNS = 2

/** Gutter between footnote columns, in multiples of the footnote's own type size. */
const FOOTNOTE_COLUMN_GUTTER_EM = 2

/**
 * A trailing "(...)" on a topic name, e.g. "Bite the apple (bite the bullet)".
 *
 * Anchored to the end because these are glosses on the whole name. A parenthetical in the middle
 * of a name is part of the name and is left alone.
 */
const TRAILING_PARENTHETICAL = /^(.*\S)\s*\(([^()]+)\)$/

const WHITE_BACKGROUND = '#ffffff'

export type ContactSheetFormat = 'classic' | 'a3' | '305x425'

export interface ContactSheetLayoutConfig {
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly landscapeAspectRatio: number
  readonly padding: number
  readonly rowSpacing: number
  readonly extraSpacingAdjustment: number
  readonly textSpacingReduction: number
  readonly textTopGap: number
  readonly imageSizeFactor: number
  readonly textHeightRatio: number
  readonly sequenceSpaceRatio: number
  readonly labelFontSize: number
  readonly sequenceFontSizeMin: number
  readonly sequenceFontSizeRatio: number
  readonly sequenceWidthRatio: number
  readonly sequenceBottomMargin: number
  readonly textVerticalPosition: number
}

export const CONTACT_SHEET_LAYOUTS = {
  classic: {
    canvasWidth: 3986,
    canvasHeight: 2657,
    landscapeAspectRatio: 3 / 2,
    padding: 30,
    rowSpacing: 10,
    extraSpacingAdjustment: 12,
    textSpacingReduction: 32,
    textTopGap: 4,
    imageSizeFactor: 0.99,
    textHeightRatio: 0.025,
    sequenceSpaceRatio: 0.04,
    labelFontSize: 28,
    sequenceFontSizeMin: 32,
    sequenceFontSizeRatio: 0.05,
    sequenceWidthRatio: 0.12,
    sequenceBottomMargin: 32,
    textVerticalPosition: 0.45,
  },
  a3: {
    canvasWidth: 4961,
    canvasHeight: 3508,
    landscapeAspectRatio: 3 / 2,
    padding: 40,
    rowSpacing: 13,
    extraSpacingAdjustment: 16,
    textSpacingReduction: 42,
    textTopGap: 5,
    imageSizeFactor: 0.99,
    textHeightRatio: 0.025,
    sequenceSpaceRatio: 0.04,
    labelFontSize: 37,
    sequenceFontSizeMin: 42,
    sequenceFontSizeRatio: 0.05,
    sequenceWidthRatio: 0.12,
    sequenceBottomMargin: 42,
    textVerticalPosition: 0.45,
  },
  /**
   * 305 x 425 mm at 300 DPI, printed landscape (425 wide x 305 tall). Slightly wider and
   * marginally shorter than `a3`, so the absolute pixel values below are the `a3` ones scaled
   * by the ~1.02 mean linear factor; every ratio is shared verbatim.
   */
  '305x425': {
    canvasWidth: 5020,
    canvasHeight: 3602,
    landscapeAspectRatio: 3 / 2,
    padding: 41,
    rowSpacing: 13,
    extraSpacingAdjustment: 16,
    textSpacingReduction: 43,
    textTopGap: 5,
    imageSizeFactor: 0.99,
    textHeightRatio: 0.025,
    sequenceSpaceRatio: 0.04,
    labelFontSize: 38,
    sequenceFontSizeMin: 43,
    sequenceFontSizeRatio: 0.05,
    sequenceWidthRatio: 0.12,
    sequenceBottomMargin: 43,
    textVerticalPosition: 0.45,
  },
} satisfies Record<ContactSheetFormat, ContactSheetLayoutConfig>

export class InvalidSheetParamsError extends Schema.TaggedErrorClass<InvalidSheetParamsError>()(
  'InvalidSheetParamsError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ContactSheetBuildError extends Schema.TaggedErrorClass<ContactSheetBuildError>()(
  'ContactSheetBuildError',
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
  format?: ContactSheetFormat
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
    'bottom-left': {
      row: isSmallGrid ? BOTTOM_ROW_SMALL : BOTTOM_ROW_LARGE,
      col: LEFT_COL,
    },
    'top-right': {
      row: TOP_ROW,
      col: isSmallGrid ? RIGHT_COL_SMALL : RIGHT_COL_LARGE,
    },
    'top-left': {
      row: TOP_ROW,
      col: LEFT_COL,
    },
    center: {
      row: isSmallGrid ? MIDDLE_ROW : CENTER_ROW_LARGE,
      col: isSmallGrid ? MIDDLE_COL : CENTER_COL_LARGE,
    },
    'bottom-right': {
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function calculateSheetVariables(
  reference: string,
  cols: number,
  rows: number,
  layout: ContactSheetLayoutConfig,
  footnoteSpace: number,
): SheetVariables {
  const textHeight = Math.round(layout.canvasHeight * layout.textHeightRatio)
  const sequenceSpace = reference ? Math.round(layout.canvasHeight * layout.sequenceSpaceRatio) : 0

  const availableWidth = layout.canvasWidth - layout.padding * (cols + 1)
  const availableHeight =
    layout.canvasHeight -
    layout.padding * (rows + 1) -
    sequenceSpace -
    footnoteSpace +
    layout.extraSpacingAdjustment

  const cellWidth = Math.floor(availableWidth / cols)
  const cellHeight = Math.floor(availableHeight / rows)
  const availableImageHeight = cellHeight - (textHeight - layout.textSpacingReduction)

  let imageWidth: number
  let imageHeight: number
  if (cellWidth / availableImageHeight > layout.landscapeAspectRatio) {
    imageHeight = Math.floor(availableImageHeight * layout.imageSizeFactor)
    imageWidth = Math.floor(imageHeight * layout.landscapeAspectRatio)
  } else {
    imageWidth = Math.floor(cellWidth * layout.imageSizeFactor)
    imageHeight = Math.floor(imageWidth / layout.landscapeAspectRatio)
  }

  return {
    cellWidth,
    cellHeight,
    availableImageHeight,
    imageWidth,
    imageHeight,
    textHeight,
    sequenceSpace,
    footnoteSpace,
    availableWidth,
    availableHeight,
  }
}

/**
 * Split a topic name into the part that fits under a photo and the part that does not.
 *
 * Captions are clipped to the cell width by their SVG viewport, and the bilingual names carrying
 * an idiomatic gloss — "Bita i det sura äpplet / Bite the apple (bite the bullet)" — ran past that
 * edge and lost the gloss mid-word. The gloss moves to a footnote in the bottom margin and the
 * caption keeps a marker pointing at it.
 */
function splitTopicNote(name: string): { caption: string; note?: string } {
  const match = TRAILING_PARENTHETICAL.exec(name.trim())
  const caption = match?.[1]
  const note = match?.[2]?.trim()
  if (!caption || !note) return { caption: name }
  return { caption, note }
}

interface TopicFootnote {
  readonly orderIndex: number
  readonly note: string
}

/**
 * The footnotes this sheet needs, keyed by the same number its caption shows.
 *
 * Driven by the images rather than by `topics`: a marathon's topic list is the full 24 even when
 * the sheet is an 8-photo one, and a footnote for a topic that is not on the sheet is noise.
 */
function getTopicFootnotes(
  images: ReadonlyArray<ContactSheetImageFile>,
  topics: ReadonlyArray<{ name: string; orderIndex: number }>,
): ReadonlyArray<TopicFootnote> {
  return images
    .map(({ orderIndex }) => {
      const topic = topics.find((t) => t.orderIndex === orderIndex)
      const note = topic ? splitTopicNote(topic.name).note : undefined
      return note ? { orderIndex, note } : undefined
    })
    .filter((footnote): footnote is TopicFootnote => footnote !== undefined)
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

function getFootnoteLineHeight(layout: ContactSheetLayoutConfig) {
  return Math.round(layout.labelFontSize * FOOTNOTE_LINE_HEIGHT_FACTOR)
}

function getFootnoteRowCount(footnoteCount: number) {
  return Math.ceil(footnoteCount / FOOTNOTE_COLUMNS)
}

function formatFootnote(footnote: TopicFootnote) {
  return `${FOOTNOTE_MARKER} ${footnote.orderIndex + LABEL_INDEX_OFFSET} - ${footnote.note}`
}

/**
 * How much of the footnote block the grid has to pay for.
 *
 * The strip between the bottom row's captions and the participant reference's baseline is already
 * empty white — two or three glosses' worth on most sheets — so charging the grid for every
 * footnote line shrinks the photos to make room that was there all along. Only the overflow is
 * taken off the grid; a sheet whose footnotes fit the existing margin lays out untouched.
 *
 * The free run is measured against a footnote-free layout. Reserving space only ever moves that
 * last row of captions up, so this is a floor on the space that will actually be free, never an
 * overestimate — the block cannot end up overlapping the grid.
 */
function getFootnoteSpace({
  reference,
  cols,
  rows,
  layout,
  footnoteCount,
}: {
  reference: string
  cols: number
  rows: number
  layout: ContactSheetLayoutConfig
  footnoteCount: number
}) {
  if (footnoteCount === 0) return 0

  const unreserved = calculateSheetVariables(reference, cols, rows, layout, 0)
  const lastCaptionBottom =
    layout.padding * 2 +
    (rows - 1) * (unreserved.cellHeight + layout.rowSpacing) +
    unreserved.availableImageHeight +
    layout.textTopGap +
    unreserved.textHeight

  const free = layout.canvasHeight - layout.sequenceBottomMargin - lastCaptionBottom
  const needed = getFootnoteRowCount(footnoteCount) * getFootnoteLineHeight(layout)

  return Math.max(0, needed - Math.max(0, free))
}

function getImageLabel(
  orderIndex: number,
  topics: ReadonlyArray<{ name: string; orderIndex: number }>,
) {
  const topic = topics.find((t) => t.orderIndex === orderIndex)
  if (!topic) return undefined

  const { caption, note } = splitTopicNote(topic.name)
  const number = topic.orderIndex + LABEL_INDEX_OFFSET
  return `${number} - ${caption}${note ? ` ${FOOTNOTE_MARKER}` : ''}`
}

/**
/**
 * The gutter every photo and every caption in a cell starts at.
 *
 * Half the slack a nominal 3:2 frame leaves in the cell, so a 3:2 photo looks optically centred
 * while everything else lines up with it rather than finding its own centre.
 */
function getCellGutter(sheetVariables: SheetVariables) {
  return Math.floor((sheetVariables.cellWidth - sheetVariables.imageWidth) / 2)
}

/**
 * The box a photo is fitted into: the cell minus the gutter it starts at.
 *
 * Capping the width here is what lets {@link getImagePosition} apply the gutter unconditionally.
 * Fitting into the full `cellWidth` instead meant a frame wider than 3:2 came back at the full
 * width and had nowhere to put the gutter — it was dropped at the cell's left edge, sitting a
 * gutter's width left of its own caption while its 3:2 neighbours lined up.
 */
function getPhotoBoxWidth(sheetVariables: SheetVariables) {
  return sheetVariables.cellWidth - getCellGutter(sheetVariables)
}

/**
 * Place a prepared image in its cell, anchored to its top-left corner.
 *
 * The left edge is the cell gutter — the same offset {@link generateTextLabelSvg} starts its
 * caption at — so a portrait frame, a square crop, a panorama and a sponsor logo all share one
 * left edge with their captions instead of each finding its own.
 *
 * The top edge is the cell's own origin. The photo box is roughly 1.6:1, so a 3:2 frame and
 * anything taller fills its height exactly while a 16:9 or panoramic frame cannot; centring that
 * leftover left those frames hovering mid-cell while their neighbours sat flush.
 *
 * Between the two, an unusual aspect ratio only ever makes a photo smaller — it never moves it.
 */
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
    top: y,
    left: x + getCellGutter(sheetVariables),
  }
}

function calculateCoordinateValues({
  col,
  row,
  sheetVariables,
  layout,
}: {
  col: number
  row: number
  sheetVariables: SheetVariables
  layout: ContactSheetLayoutConfig
}) {
  return {
    x: layout.padding + col * (sheetVariables.cellWidth + layout.padding),
    y: layout.padding * 2 + row * (sheetVariables.cellHeight + layout.rowSpacing),
  }
}

function getCellPositions(rows: number, cols: number) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({ row, col })),
  ).flat()
}

function getParticipantReferenceCompositePart(
  participantReferenceSvg: Buffer,
  layout: ContactSheetLayoutConfig,
): CompositeImage {
  const seqWidth = Math.floor(layout.canvasWidth * layout.sequenceWidthRatio)
  const seqHeight = Math.floor(layout.canvasHeight)

  return {
    input: participantReferenceSvg,
    top: layout.canvasHeight - seqHeight,
    left: layout.canvasWidth - seqWidth,
  }
}

function generateParticipantReferenceSvg({
  reference,
  layout,
}: {
  reference: string
  layout: ContactSheetLayoutConfig
}) {
  const seqFontSize = Math.max(
    layout.sequenceFontSizeMin,
    Math.floor(layout.canvasHeight * layout.sequenceFontSizeRatio),
  )
  const seqWidth = Math.floor(layout.canvasWidth * layout.sequenceWidthRatio)
  const seqHeight = Math.floor(layout.canvasHeight)

  const seqSvg = `
      <svg width="${seqWidth}" height="${seqHeight}">
        <text x="${seqWidth / 2}" y="${seqHeight - layout.sequenceBottomMargin}"
              font-family="Liberation Sans, Arial, sans-serif"
              font-size="${seqFontSize}" 
              font-weight="bold"
              fill="black" 
              text-anchor="middle">${escapeXml(reference)}</text>
      </svg>
    `
  return Buffer.from(seqSvg)
}

/**
 * The footnote block for the bottom margin, bottom-aligned on the participant reference's baseline.
 *
 * It occupies the width left of the reference's column, so the two never overlap however long a
 * gloss runs.
 *
 * Filled column-major — the numbers run down the first column and continue down the second — so
 * the list stays in topic order the way a numbered reference list does, rather than zig-zagging
 * across the page.
 */
function generateFootnotesSvg({
  footnotes,
  layout,
}: {
  footnotes: ReadonlyArray<TopicFootnote>
  layout: ContactSheetLayoutConfig
}) {
  const lineHeight = getFootnoteLineHeight(layout)
  const rows = getFootnoteRowCount(footnotes.length)
  const width = getFootnotesWidth(layout)
  const columnWidth = getFootnoteColumnWidth(footnotes, layout)
  const gutter = getFootnoteColumnGutter(layout)
  const height = rows * lineHeight

  const lines = footnotes
    .map((footnote, index) => {
      const label = formatFootnote(footnote)
      const column = Math.floor(index / rows)
      const row = index % rows
      return `<text x="${column * (columnWidth + gutter)}" y="${row * lineHeight + layout.labelFontSize}"
                font-family="Liberation Sans, Arial, sans-serif"
                font-size="${layout.labelFontSize}"
                font-weight="500"
                fill="black"
                text-anchor="start">${escapeXml(label)}</text>`
    })
    .join('')

  return Buffer.from(`<svg width="${width}" height="${height}">${lines}</svg>`)
}

function getFootnotesWidth(layout: ContactSheetLayoutConfig) {
  const seqWidth = Math.floor(layout.canvasWidth * layout.sequenceWidthRatio)
  return layout.canvasWidth - seqWidth - layout.padding * 2
}

function getFootnoteColumnGutter(layout: ContactSheetLayoutConfig) {
  return layout.labelFontSize * FOOTNOTE_COLUMN_GUTTER_EM
}

/**
 * Rough advance width of a string, in multiples of the font size.
 *
 * There is no font metrics engine on this side — the text goes to libvips as SVG and is measured
 * by fontconfig at render time — so column width is estimated from character classes calibrated
 * against Liberation Sans. Deliberately biased high: overestimating only widens the gutter, while
 * underestimating runs one column into the next.
 */
function estimateEmWidth(text: string) {
  let em = 0
  for (const character of text) {
    if (/[\p{Lu}\d]/u.test(character)) em += 0.62
    else if (/\p{Ll}/u.test(character)) em += 0.5
    else em += 0.3
  }
  return em
}

/**
 * Columns as wide as the longest gloss needs, not half the margin each.
 *
 * These lists are a handful of short phrases, and splitting the full margin evenly stranded the
 * second column out by the reference. Capped at the even split so a long gloss still cannot push
 * the second column off the end of the block.
 */
function getFootnoteColumnWidth(
  footnotes: ReadonlyArray<TopicFootnote>,
  layout: ContactSheetLayoutConfig,
) {
  const gutters = getFootnoteColumnGutter(layout) * (FOOTNOTE_COLUMNS - 1)
  const evenSplit = Math.floor((getFootnotesWidth(layout) - gutters) / FOOTNOTE_COLUMNS)

  const widest = footnotes.reduce(
    (max, footnote) => Math.max(max, estimateEmWidth(formatFootnote(footnote))),
    0,
  )

  return Math.min(evenSplit, Math.ceil(widest * layout.labelFontSize))
}

function getFootnotesCompositePart(
  footnotesSvg: Buffer,
  footnoteCount: number,
  layout: ContactSheetLayoutConfig,
): CompositeImage {
  const height = getFootnoteRowCount(footnoteCount) * getFootnoteLineHeight(layout)

  return {
    input: footnotesSvg,
    top: layout.canvasHeight - layout.sequenceBottomMargin - height,
    left: layout.padding,
  }
}

function generateTextLabelSvg({
  label,
  sheetVariables,
  layout,
}: {
  label: string
  sheetVariables: SheetVariables
  layout: ContactSheetLayoutConfig
}) {
  const textSvg = `
        <svg width="${sheetVariables.cellWidth}" height="${sheetVariables.textHeight}">
          <text x="${getCellGutter(sheetVariables)}" y="${sheetVariables.textHeight * layout.textVerticalPosition}"
                font-family="Liberation Sans, Arial, sans-serif"
                font-size="${layout.labelFontSize}"
                font-weight="500"
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
>()('@blikka/packages/image-manipulation/ContactSheetBuilder') {}

const makeContactSheetBuilder = Effect.gen(function* () {
  const sharp = yield* SharpImageService

  // Before the first `<text>` render in this process: fontconfig reads FONTCONFIG_PATH once, and a
  // later install is ignored for the life of the process. See ./bundled-fonts.ts.
  const fontDir = installBundledFonts()
  if (fontDir) {
    yield* Effect.logDebug('Bundled contact-sheet fonts installed', { fontDir })
  } else {
    yield* Effect.logError(
      'Could not install bundled fonts; contact-sheet captions will render as empty boxes',
      { cause: bundledFontsError() },
    )
  }

  const validateAndSortImageFiles = Effect.fn('ContactSheetBuilder.validateAndSortImageFiles')(
    function* (images: ReadonlyArray<ContactSheetImageFile>) {
      if (images.length !== SMALL_IMAGE_COUNT && images.length !== LARGE_IMAGE_COUNT) {
        return yield* new InvalidSheetParamsError({
          message: `Invalid image count. Expected 8 or 24, got ${images.length}`,
        })
      }

      return [...images].sort((a, b) => a.orderIndex - b.orderIndex)
    },
  )

  const processSponsorImage = Effect.fn('ContactSheetBuilder.processSponsorImage')(function* (
    sponsorFile: Buffer,
    sheetVariables: SheetVariables,
  ) {
    // The same box the photos get. Sizing the sponsor to the full `cellHeight` let it grow into
    // the label strip below its cell while still being positioned as if it were a photo.
    return yield* sharp.prepareForCanvas(
      Buffer.from(sponsorFile),
      getPhotoBoxWidth(sheetVariables),
      sheetVariables.availableImageHeight,
      'inside',
      WHITE_BACKGROUND,
    )
  })

  const processImage = Effect.fn('ContactSheetBuilder.processImage')(function* (
    imageFile: Buffer,
    orderIndex: number,
    topics: ReadonlyArray<{ name: string; orderIndex: number }>,
    sheetVariables: SheetVariables,
    layout: ContactSheetLayoutConfig,
  ) {
    const image = yield* sharp.prepareForCanvas(
      Buffer.from(imageFile),
      getPhotoBoxWidth(sheetVariables),
      sheetVariables.availableImageHeight,
      'inside',
      WHITE_BACKGROUND,
    )

    // A caption is decoration; the photo is the deliverable. Topics can be renamed, removed, or
    // reordered after an upload, and failing the whole sheet over a missing one sent the message
    // round the retry loop into the DLQ. Render the photo uncaptioned instead.
    const label = getImageLabel(orderIndex, topics)
    if (!label) {
      yield* Effect.logWarning('No topic label for image, rendering it without a caption', {
        orderIndex,
      })
      return { image, textBuffer: undefined }
    }

    const textBuffer = generateTextLabelSvg({
      sheetVariables,
      label,
      layout,
    })

    return {
      image,
      textBuffer,
    }
  })

  const createSheet: ContactSheetBuilder['Service']['createSheet'] = Effect.fn(
    'ContactSheetBuilder.createSheet',
  )(
    function* (params: CreateSheetParams) {
      const { reference, images, sponsorImage, sponsorPosition, topics } = params
      const layout = CONTACT_SHEET_LAYOUTS[params.format ?? 'classic']

      const imageFiles = yield* validateAndSortImageFiles(images)

      const { cols, rows, sponsorRow, sponsorCol } = getGridConfig(
        sponsorPosition,
        imageFiles.length,
      )
      const footnotes = getTopicFootnotes(imageFiles, topics)
      const sheetVariables = calculateSheetVariables(
        reference,
        cols,
        rows,
        layout,
        getFootnoteSpace({ reference, cols, rows, layout, footnoteCount: footnotes.length }),
      )

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
              layout,
            })

            if (isSponsor) {
              if (!sponsorImage) {
                return yield* Effect.fail(
                  new InvalidSheetParamsError({
                    message: 'Sponsor image not found',
                  }),
                )
              }
              const preparedSponsorImage = yield* processSponsorImage(
                Buffer.from(sponsorImage),
                sheetVariables,
              )
              return [
                {
                  input: preparedSponsorImage.buffer,
                  ...getImagePosition({ x, y, sheetVariables }),
                },
              ]
            }

            if (imageIndex !== undefined && imageIndex < imageFiles.length) {
              const file = imageFiles[imageIndex]
              if (!file) {
                return yield* Effect.fail(
                  new InvalidSheetParamsError({
                    message: 'Image not found when processing',
                  }),
                )
              }
              const { image, textBuffer } = yield* processImage(
                Buffer.from(file.buffer),
                file.orderIndex,
                topics,
                sheetVariables,
                layout,
              )
              const imagePart = {
                input: image.buffer,
                ...getImagePosition({ x, y, sheetVariables }),
              }

              if (!textBuffer) {
                return [imagePart]
              }

              return [
                imagePart,
                {
                  input: textBuffer,
                  top: y + sheetVariables.availableImageHeight + layout.textTopGap,
                  left: x,
                },
              ]
            }

            return []
          }),
        { concurrency: 2 },
      ).pipe(Effect.map((data) => data.flat()))

      const participantReferenceSvg = generateParticipantReferenceSvg({
        reference,
        layout,
      })
      const participantReferenceCompositePart = getParticipantReferenceCompositePart(
        participantReferenceSvg,
        layout,
      )

      const footnoteParts = footnotes.length
        ? [
            getFootnotesCompositePart(
              generateFootnotesSvg({ footnotes, layout }),
              footnotes.length,
              layout,
            ),
          ]
        : []

      const finalSheet = yield* sharp.createCanvasSheet({
        width: layout.canvasWidth,
        height: layout.canvasHeight,
        background: WHITE_BACKGROUND,
        items: [...compositeImages, ...footnoteParts, participantReferenceCompositePart],
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
