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

interface TestState {
  readonly prepareCalls: ReadonlyArray<PrepareCall>
  readonly canvasCalls: ReadonlyArray<CanvasCall>
  readonly prepareResult: Effect.Effect<Buffer, SharpError>
  readonly canvasResult: Effect.Effect<Buffer, SharpError>
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  prepareCalls: [],
  canvasCalls: [],
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
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          prepareCalls: [...current.prepareCalls, { buffer, width, height, fit, background }],
        }))
        return yield* state.prepareResult
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
      assert.strictEqual(state.prepareCalls[0]?.width, 1288)
      assert.strictEqual(state.prepareCalls[0]?.height, 780)
      assert.strictEqual(state.prepareCalls[8]?.width, 1288)
      assert.strictEqual(state.prepareCalls[8]?.height, 814)
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
      assert.strictEqual(state.prepareCalls[0]?.width, 1600)
      assert.strictEqual(state.prepareCalls[0]?.height, 1028)
      assert.strictEqual(state.prepareCalls[8]?.width, 1600)
      assert.strictEqual(state.prepareCalls[8]?.height, 1074)

      const referenceSvg = state.canvasCalls[0]?.items.at(-1)?.input
      assert.instanceOf(referenceSvg, Buffer)
      assert.include(referenceSvg?.toString(), 'A3&lt;&amp;&gt;')
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

  it.effect('fails when an image label cannot be found', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const builder = yield* ContactSheetBuilder
          return yield* builder
            .createSheet({
              reference: 'REF123',
              images: makeImages(8),
              sponsorPosition: 'bottom-right',
              topics: makeTopics(7),
            })
            .pipe(Effect.flip)
        }),
      )

      assert.instanceOf(result, InvalidSheetParamsError)
      assert.strictEqual(result.message, 'Label not found (orderIndex: 7)')
      assert.lengthOf(state.prepareCalls, 8)
      assert.deepStrictEqual(state.canvasCalls, [])
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
