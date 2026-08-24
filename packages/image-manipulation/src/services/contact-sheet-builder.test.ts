import { assert, describe, it } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'

import {
  ContactSheetBuilder,
  ContactSheetBuilderLayerNoDeps,
  ContactSheetBuildError,
  InvalidSheetParamsError,
} from './contact-sheet-builder'
import { SharpError, SharpImageService, type SheetImagePart } from './sharp-image-service'

const sheetBytes = Buffer.from('sheet')

const makeImages = (count: number) =>
  Array.from({ length: count }, (_, orderIndex) => ({
    orderIndex,
    buffer: Buffer.from(`image-${orderIndex}`),
  }))

const makeTopics = (count: number) =>
  Array.from({ length: count }, (_, orderIndex) => ({
    name: `Topic ${orderIndex + 1}`,
    orderIndex,
  }))

interface PrepareCall {
  readonly buffer: Buffer
  readonly width: number
  readonly height: number
  readonly fit: 'cover' | 'inside'
  readonly background: string
}

interface CanvasCall {
  readonly width: number
  readonly height: number
  readonly background: string
  readonly items: ReadonlyArray<SheetImagePart>
}

interface PreparedImage {
  readonly buffer: Buffer
  readonly width: number
  readonly height: number
}

interface TestState {
  readonly prepareCalls: ReadonlyArray<PrepareCall>
  readonly canvasCalls: ReadonlyArray<CanvasCall>
  /** Given the requested box, the dimensions the resize "actually" produced. */
  readonly prepareSize: (call: PrepareCall) => { width: number; height: number }
  readonly prepareResult: Effect.Effect<Buffer, SharpError>
  readonly canvasResult: Effect.Effect<Buffer, SharpError>
}

/** What `fit: 'inside'` gives a 3:2 source — the common case. */
const fitLandscape = (call: PrepareCall) =>
  call.width / call.height > 3 / 2
    ? { width: Math.floor(call.height * (3 / 2)), height: call.height }
    : { width: call.width, height: Math.floor(call.width / (3 / 2)) }

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  prepareCalls: [],
  canvasCalls: [],
  prepareSize: fitLandscape,
  prepareResult: Effect.succeed(Buffer.from('prepared')),
  canvasResult: Effect.succeed(sheetBytes),
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const sharp = SharpImageService.of({
    resize: () => Effect.succeed(Buffer.from('resized')),
    prepareForCanvas: (
      buffer: Buffer,
      width: number,
      height: number,
      fit: 'cover' | 'inside',
      background: string,
    ) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const call: PrepareCall = { buffer, width, height, fit, background }
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          prepareCalls: [...current.prepareCalls, call],
        }))
        const prepared = yield* state.prepareResult
        return { buffer: prepared, ...state.prepareSize(call) } satisfies PreparedImage
      }),
    createCanvasSheet: ({
      width,
      height,
      background,
      items,
    }: {
      width: number
      height: number
      background: string
      items: SheetImagePart[]
    }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          canvasCalls: [...current.canvasCalls, { width, height, background, items: [...items] }],
        }))
        return yield* state.canvasResult
      }),
  } as unknown as SharpImageService['Service'])

  return ContactSheetBuilderLayerNoDeps.pipe(Layer.provide(Layer.succeed(SharpImageService)(sharp)))
}

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, ContactSheetBuilder>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(makeTestLayer(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

describe('ContactSheetBuilder', () => {
  it.effect('builds a small contact sheet with labels, sponsor, and reference', () =>
    Effect.gen(function* () {
      const unsortedImages = [...makeImages(8)].reverse()

      const { result, state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          return yield* builder.createSheet({
            reference: 'REF<&>',
            images: unsortedImages,
            sponsorImage: Buffer.from('sponsor'),
            sponsorPosition: 'bottom-right',
            topics: makeTopics(8),
          })
        }),
      )

      assert.strictEqual(result, sheetBytes)
      assert.lengthOf(state.prepareCalls, 9)
      assert.deepStrictEqual(
        state.prepareCalls.map((call) => call.buffer.toString()),
        [
          'image-0',
          'image-1',
          'image-2',
          'image-3',
          'image-4',
          'image-5',
          'image-6',
          'image-7',
          'sponsor',
        ],
      )
      assert.isTrue(state.prepareCalls.every((call) => call.fit === 'inside'))
      assert.isTrue(state.prepareCalls.every((call) => call.background === '#ffffff'))

      assert.lengthOf(state.canvasCalls, 1)
      const canvasCall = state.canvasCalls[0]
      assert.strictEqual(canvasCall?.width, 3986)
      assert.strictEqual(canvasCall?.height, 2657)
      assert.strictEqual(canvasCall?.background, '#ffffff')
      assert.lengthOf(canvasCall?.items ?? [], 18)

      const labelSvg = canvasCall?.items[1]?.input
      assert.instanceOf(labelSvg, Buffer)
      assert.include(labelSvg?.toString(), '1 - Topic 1')

      const referenceSvg = canvasCall?.items.at(-1)?.input
      assert.instanceOf(referenceSvg, Buffer)
      assert.include(referenceSvg?.toString(), 'REF&lt;&amp;&gt;')
    }),
  )

  it.effect('builds a large contact sheet using a 5 by 5 canvas grid', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          yield* builder.createSheet({
            reference: 'REF123',
            images: makeImages(24),
            sponsorImage: Buffer.from('sponsor'),
            sponsorPosition: 'top-right',
            topics: makeTopics(24),
          })
        }),
      )

      assert.lengthOf(state.prepareCalls, 25)
      assert.lengthOf(state.canvasCalls[0]?.items ?? [], 50)
      assert.strictEqual(state.prepareCalls[4]?.buffer.toString(), 'sponsor')
      assert.strictEqual(state.prepareCalls[24]?.buffer.toString(), 'image-23')
    }),
  )

  it.effect('builds an explicit classic contact sheet with the current canvas size', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          yield* builder.createSheet({
            reference: 'REF123',
            images: makeImages(8),
            sponsorImage: Buffer.from('sponsor'),
            sponsorPosition: 'bottom-right',
            topics: makeTopics(8),
            format: 'classic',
          })
        }),
      )

      assert.strictEqual(state.canvasCalls[0]?.width, 3986)
      assert.strictEqual(state.canvasCalls[0]?.height, 2657)
      assert.strictEqual(state.prepareCalls[0]?.width, 1223)
      assert.strictEqual(state.prepareCalls[0]?.height, 780)
      // The sponsor gets the photo box, not the taller full cell — the extra height used to let
      // it grow down into the caption strip.
      assert.strictEqual(state.prepareCalls[8]?.width, 1223)
      assert.strictEqual(state.prepareCalls[8]?.height, 780)
    }),
  )

  it.effect('builds an A3 contact sheet using landscape A3 dimensions', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          yield* builder.createSheet({
            reference: 'A3<&>',
            images: makeImages(8),
            sponsorImage: Buffer.from('sponsor'),
            sponsorPosition: 'bottom-right',
            topics: makeTopics(8),
            format: 'a3',
          })
        }),
      )

      assert.strictEqual(state.canvasCalls[0]?.width, 4961)
      assert.strictEqual(state.canvasCalls[0]?.height, 3508)
      assert.strictEqual(state.prepareCalls[0]?.width, 1563)
      assert.strictEqual(state.prepareCalls[0]?.height, 1028)
      assert.strictEqual(state.prepareCalls[8]?.width, 1563)
      assert.strictEqual(state.prepareCalls[8]?.height, 1028)

      const referenceSvg = state.canvasCalls[0]?.items.at(-1)?.input
      assert.instanceOf(referenceSvg, Buffer)
      assert.include(referenceSvg?.toString(), 'A3&lt;&amp;&gt;')
    }),
  )

  it.effect('builds a 305 x 425 mm contact sheet in landscape orientation', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          yield* builder.createSheet({
            reference: 'MM305',
            images: makeImages(8),
            sponsorImage: Buffer.from('sponsor'),
            sponsorPosition: 'bottom-right',
            topics: makeTopics(8),
            format: '305x425',
          })
        }),
      )

      // 425 mm wide x 305 mm tall at 300 DPI — the long edge is the canvas width, matching how
      // `classic` and `a3` lay their grids out.
      assert.strictEqual(state.canvasCalls[0]?.width, 5020)
      assert.strictEqual(state.canvasCalls[0]?.height, 3602)
      assert.strictEqual(state.prepareCalls[0]?.width, 1593)
      assert.strictEqual(state.prepareCalls[0]?.height, 1056)
      assert.strictEqual(state.prepareCalls[8]?.width, 1593)
      assert.strictEqual(state.prepareCalls[8]?.height, 1056)
    }),
  )

  it.effect('fails before image processing when the image count is invalid', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          return yield* builder
            .createSheet({
              reference: 'REF123',
              images: makeImages(7),
              sponsorPosition: 'bottom-right',
              topics: makeTopics(7),
            })
            .pipe(Effect.flip)
        }),
      )

      assert.instanceOf(result, InvalidSheetParamsError)
      assert.strictEqual(result.message, 'Invalid image count. Expected 8 or 24, got 7')
      assert.deepStrictEqual(state.prepareCalls, [])
      assert.deepStrictEqual(state.canvasCalls, [])
    }),
  )

  it.effect('renders a photo without a caption when its topic label is missing', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          return yield* builder.createSheet({
            reference: 'REF123',
            images: makeImages(8),
            sponsorPosition: 'bottom-right',
            topics: makeTopics(7),
          })
        }),
      )

      assert.strictEqual(result, sheetBytes)
      assert.lengthOf(state.prepareCalls, 8)
      // 7 captioned photos (2 parts each) + 1 uncaptioned + the reference overlay.
      assert.lengthOf(state.canvasCalls[0]?.items ?? [], 16)
    }),
  )

  it.effect('moves a trailing parenthetical out of the caption and into a footnote', () =>
    Effect.gen(function* () {
      const topics = makeTopics(8).map((topic) =>
        topic.orderIndex === 2
          ? { ...topic, name: 'Bita i det sura äpplet / Bite the apple (bite the bullet)' }
          : topic,
      )

      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          yield* builder.createSheet({
            reference: 'REF123',
            images: makeImages(8),
            sponsorPosition: 'bottom-right',
            topics,
          })
        }),
      )

      const items = state.canvasCalls[0]?.items ?? []
      const captions = items.map((item) => String(item.input)).filter((s) => s.includes('<text'))

      // The gloss is gone from the caption, which now carries the marker instead.
      const caption = captions.find((text) => text.includes('Bite the apple'))
      assert.include(caption, '3 - Bita i det sura äpplet / Bite the apple *')
      assert.notInclude(caption, 'bite the bullet')

      // ...and reappears in the bottom margin, keyed by the number the caption shows.
      const footnotes = captions.find((text) => text.includes('bite the bullet'))
      assert.include(footnotes, '* 3 - bite the bullet')
    }),
  )

  it.effect('footnotes only the topics that are on the sheet', () =>
    Effect.gen(function* () {
      // A marathon's topic list is the full 24 even when the sheet is an 8-photo one.
      const topics = makeTopics(24).map((topic) =>
        topic.orderIndex === 12 ? { ...topic, name: 'Ko på isen / Cow on ice (No biggie)' } : topic,
      )

      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          yield* builder.createSheet({
            reference: 'REF123',
            images: makeImages(8),
            sponsorPosition: 'bottom-right',
            topics,
          })
        }),
      )

      const items = state.canvasCalls[0]?.items ?? []
      assert.isUndefined(items.find((item) => String(item.input).includes('No biggie')))
      // 8 photos (2 parts each) + the reference overlay, with no footnote block.
      assert.lengthOf(items, 17)
    }),
  )

  it.effect('spends the empty bottom margin before it shrinks any photo', () =>
    Effect.gen(function* () {
      const oneNote = makeTopics(8).map((topic) =>
        topic.orderIndex === 0 ? { ...topic, name: `${topic.name} (gloss)` } : topic,
      )

      const run = (topics: ReturnType<typeof makeTopics>) =>
        runWithState(makeInitialState(), () =>
          Effect.gen(function* () {
            const builder = yield* ContactSheetBuilder
            yield* builder.createSheet({
              reference: 'REF123',
              images: makeImages(8),
              sponsorPosition: 'bottom-right',
              topics,
            })
          }),
        )

      const plain = yield* run(makeTopics(8))
      const footnoted = yield* run(oneNote)

      // The strip above the reference baseline already fits a line, so the grid pays nothing.
      assert.deepStrictEqual(footnoted.state.prepareCalls[0], plain.state.prepareCalls[0])
      const items = footnoted.state.canvasCalls[0]?.items ?? []
      assert.isDefined(items.find((item) => String(item.input).includes('* 1 - gloss')))
    }),
  )

  it.effect('keeps the second footnote column inside the block however long a gloss runs', () =>
    Effect.gen(function* () {
      const topics = makeTopics(8).map((topic) =>
        topic.orderIndex < 4
          ? { ...topic, name: `${topic.name} (${'wordy gloss '.repeat(20)})` }
          : topic,
      )

      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          yield* builder.createSheet({
            reference: 'REF123',
            images: makeImages(8),
            sponsorPosition: 'bottom-right',
            topics,
          })
        }),
      )

      const items = state.canvasCalls[0]?.items ?? []
      const block = items.find((item) => String(item.input).includes('wordy gloss'))
      const offsets = [...String(block?.input).matchAll(/x="(\d+)"/g)].map((m) => Number(m[1]))

      // `classic`: canvasWidth 3986, sequenceWidthRatio 0.12, padding 30 — so the block is
      // 3986 - 478 - 60 = 3448 wide, and the second column may not start beyond its half.
      const gutter = 28 * 2
      const evenSplit = Math.floor((3448 - gutter) / 2)
      assert.deepStrictEqual(
        [...new Set(offsets)].sort((a, b) => a - b),
        [0, evenSplit + gutter],
      )
    }),
  )

  it.effect('shrinks the grid once the footnotes outgrow that margin', () =>
    Effect.gen(function* () {
      const withNotes = makeTopics(8).map((topic) => ({
        ...topic,
        name: `${topic.name} (gloss ${topic.orderIndex})`,
      }))

      const run = (topics: ReturnType<typeof makeTopics>) =>
        runWithState(makeInitialState(), () =>
          Effect.gen(function* () {
            const builder = yield* ContactSheetBuilder
            yield* builder.createSheet({
              reference: 'REF123',
              images: makeImages(8),
              sponsorPosition: 'bottom-right',
              topics,
            })
          }),
        )

      const plain = yield* run(makeTopics(8))
      const footnoted = yield* run(withNotes)

      // Eight lines is more than the margin holds, so the overflow comes off the grid and the
      // photos shrink rather than the block printing over the bottom row.
      const plainHeight = plain.state.prepareCalls[0]?.height ?? 0
      const footnotedHeight = footnoted.state.prepareCalls[0]?.height ?? 0
      assert.isBelow(footnotedHeight, plainHeight)

      // The block is bottom-aligned on the reference baseline and left of its column.
      const items = footnoted.state.canvasCalls[0]?.items ?? []
      const block = items.find((item) => String(item.input).includes('* 1 - gloss 0'))
      assert.isDefined(block)
      // `classic` is the default format: canvasHeight 2657, sequenceBottomMargin 32, padding 30.
      const lineHeight = Math.round(28 * 1.35)
      // Eight footnotes in two columns is four rows tall.
      assert.strictEqual(block?.top, 2657 - 32 - 4 * lineHeight)
      assert.strictEqual(block?.left, 30)
    }),
  )

  it.effect('starts every frame at the cell gutter, however wide it is', () =>
    Effect.gen(function* () {
      // A panorama fills the photo box's width. Fitting into the whole cell left it nowhere to
      // put the gutter, so it was dropped at the cell edge, left of its own caption.
      const { state } = yield* runWithState(
        makeInitialState({
          prepareSize: (call) => ({ width: call.width, height: Math.floor(call.width / 3) }),
        }),
        () =>
          Effect.gen(function* () {
            const builder = yield* ContactSheetBuilder
            yield* builder.createSheet({
              reference: 'REF123',
              images: makeImages(8),
              sponsorPosition: 'bottom-right',
              topics: makeTopics(8),
              format: 'classic',
            })
          }),
      )

      const items = state.canvasCalls[0]?.items ?? []
      const photos = items.filter(
        (item) => Buffer.isBuffer(item.input) && item.input.toString() === 'prepared',
      )

      // `classic`, 8 photos: cellWidth 1288, gutter 65, columns at 30 / 1348 / 2666.
      assert.deepStrictEqual(
        [...new Set(photos.map((item) => item.left))].sort((a, b) => (a ?? 0) - (b ?? 0)),
        [95, 1413, 2731],
      )

      // The captions start at that same gutter, so photo and caption share one left edge.
      const captions = items.filter((item) => String(item.input).includes('<text'))
      for (const caption of captions.slice(0, 8)) {
        assert.include(String(caption.input), 'x="65"')
      }
    }),
  )

  it.effect('anchors a frame too wide to fill the box to the top of its cell', () =>
    Effect.gen(function* () {
      // The photo box is about 1.6:1, so a 16:9 frame comes back shorter than the box. Centring
      // that leftover left it hovering mid-cell while its 3:2 neighbours sat flush.
      const { state } = yield* runWithState(
        makeInitialState({
          prepareSize: (call) => ({ width: call.width, height: Math.floor(call.width / (16 / 9)) }),
        }),
        () =>
          Effect.gen(function* () {
            const builder = yield* ContactSheetBuilder
            yield* builder.createSheet({
              reference: 'REF123',
              images: makeImages(8),
              sponsorPosition: 'bottom-right',
              topics: makeTopics(8),
              format: 'classic',
            })
          }),
      )

      const placed = (state.canvasCalls[0]?.items ?? []).filter(
        (item) => Buffer.isBuffer(item.input) && item.input.toString() === 'prepared',
      )

      // `classic`, 8 photos: padding 30, rowSpacing 10, cellHeight 814 — so rows start at
      // 60, 884 and 1708 whatever shape the photos in them turn out to be.
      assert.deepStrictEqual(
        [...new Set(placed.map((item) => item.top))].sort((a, b) => (a ?? 0) - (b ?? 0)),
        [60, 884, 1708],
      )
    }),
  )

  it.effect('keeps a full-cell-width image inside the canvas', () =>
    Effect.gen(function* () {
      // A 16:9 frame (or a wide sponsor logo) comes back from `fit: 'inside'` at the full box
      // width. Offsetting it by the 3:2 gutter pushed the right-hand column past the canvas.
      const { state } = yield* runWithState(
        makeInitialState({
          prepareSize: (call) => ({ width: call.width, height: Math.floor(call.width / (16 / 9)) }),
        }),
        () =>
          Effect.gen(function* () {
            const builder = yield* ContactSheetBuilder
            yield* builder.createSheet({
              reference: 'REF123',
              images: makeImages(8),
              sponsorImage: Buffer.from('sponsor'),
              sponsorPosition: 'bottom-right',
              topics: makeTopics(8),
              format: 'classic',
            })
          }),
      )

      // Every photo/sponsor composite is the mock's 'prepared' buffer, 1223 px wide here — the
      // cell minus its gutter; the caption and reference overlays are SVGs with their own widths.
      const placedImages = (state.canvasCalls[0]?.items ?? []).filter(
        (item) => Buffer.isBuffer(item.input) && item.input.toString() === 'prepared',
      )

      assert.lengthOf(placedImages, 9)
      for (const item of placedImages) {
        assert.isAtMost((item.left ?? 0) + 1223, 3986)
      }
    }),
  )

  it.effect('left-aligns a portrait photo with its caption', () =>
    Effect.gen(function* () {
      // `fit: 'inside'` leaves a 2:3 frame height-bound and far narrower than its cell, so
      // centring it would strand the caption in the white space to its left.
      const { state } = yield* runWithState(
        makeInitialState({
          prepareSize: (call) => ({
            width: Math.floor(call.height * (2 / 3)),
            height: call.height,
          }),
        }),
        () =>
          Effect.gen(function* () {
            const builder = yield* ContactSheetBuilder
            yield* builder.createSheet({
              reference: 'REF123',
              images: makeImages(8),
              sponsorPosition: 'bottom-right',
              topics: makeTopics(8),
              format: 'classic',
            })
          }),
      )

      // Each captioned photo composites as [photo, caption]; the reference overlay trails.
      const items = state.canvasCalls[0]?.items ?? []
      assert.lengthOf(items, 17)

      for (let index = 0; index < 8; index++) {
        const photo = items[index * 2]
        const caption = items[index * 2 + 1]
        const captionSvg = caption?.input?.toString() ?? ''
        const textX = Number(/<text x="(\d+)"/.exec(captionSvg)?.[1])

        // The caption SVG spans the whole cell, so the text's own x is the shared left edge.
        assert.strictEqual(textX, 65)
        assert.strictEqual(photo?.left, (caption?.left ?? 0) + textX)
      }
    }),
  )

  it.effect('maps sharp failures to contact sheet build failures', () =>
    Effect.gen(function* () {
      const sharpError = new SharpError({ message: 'sharp failed' })

      const { result } = yield* runWithState(
        makeInitialState({ prepareResult: Effect.fail(sharpError) }),
        () =>
          Effect.gen(function* () {
            const builder = yield* ContactSheetBuilder
            return yield* builder
              .createSheet({
                reference: 'REF123',
                images: makeImages(8),
                sponsorPosition: 'bottom-right',
                topics: makeTopics(8),
              })
              .pipe(Effect.flip)
          }),
      )

      assert.instanceOf(result, ContactSheetBuildError)
      assert.strictEqual(result.message, 'sharp failed')
      assert.strictEqual(result.cause, sharpError)
    }),
  )
})
