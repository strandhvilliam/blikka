import { assert, describe, it } from "@effect/vitest"
import { BusService, S3Service } from "@blikka/aws"
import {
  ExifKVRepository,
  type ExifState,
  type ParticipantState,
  type SubmissionState,
  UploadSessionRepository,
} from "@blikka/kv-store"
import { ExifParser, SharpImageService } from "@blikka/image-manipulation"
import { Effect, Layer, Option, Ref } from "effect"
import { UploadsConfig } from "./config"
import {
  PhotoNotFoundError,
  type ProcessSubmissionInput,
  SubmissionProcessor,
  UploadProcessorLayer,
} from "./submission-processor"

const uploadSessionId = "upload-session-1"
const input: ProcessSubmissionInput = {
  key: "demo/REF123/03/photo.jpg",
  domain: "demo",
  reference: "REF123",
  orderIndex: 2,
  fileName: "photo.jpg",
}
const photoBytes = Uint8Array.from([1, 2, 3])
const thumbnailBytes = Buffer.from([4, 5, 6])

interface TestState {
  readonly submissions: Record<number, SubmissionState | undefined>
  readonly participant: ParticipantState | undefined
  readonly participantAfterIncrement: ParticipantState | undefined
  readonly files: Record<string, Uint8Array | undefined>
  readonly exif: Record<number, ExifState | undefined>
  readonly parseResult: Effect.Effect<ExifState, unknown>
  readonly resizeResult: Effect.Effect<Buffer, unknown>
  readonly incrementStatus:
    | "FINALIZED"
    | "PROCESSED_SUBMISSION"
    | "DUPLICATE_ORDER_INDEX"
    | "ALREADY_FINALIZED"
    | "INVALID_ORDER_INDEX"
    | "MISSING_DATA"
  readonly s3Gets: ReadonlyArray<{ bucket: string; key: string }>
  readonly increments: ReadonlyArray<number>
  readonly submissionUpdates: ReadonlyArray<{
    orderIndex: number
    state: Partial<SubmissionState>
  }>
  readonly thumbnailPuts: ReadonlyArray<{ bucket: string; key: string; file: Buffer }>
  readonly finalizedEvents: ReadonlyArray<{
    domain: string
    reference: string
    uploadSessionId: string
  }>
}

type S3PutFileOutput = Effect.Success<ReturnType<S3Service["Service"]["putFile"]>>
type BusSendFinalizedEventOutput = Effect.Success<
  ReturnType<BusService["Service"]["sendFinalizedEvent"]>
>

const makeSubmissionState = (overrides: Partial<SubmissionState> = {}): SubmissionState => ({
  uploadSessionId,
  key: input.key,
  orderIndex: input.orderIndex,
  uploaded: false,
  thumbnailKey: null,
  exifProcessed: false,
  ...overrides,
})

const makeParticipantState = (overrides: Partial<ParticipantState> = {}): ParticipantState => ({
  uploadSessionId,
  expectedCount: 1,
  orderIndexes: [input.orderIndex],
  processedIndexes: [0],
  validated: false,
  zipKey: "",
  contactSheetKey: "",
  errors: [],
  finalized: false,
  checkedAt: null,
  ...overrides,
})

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  submissions: {
    [input.orderIndex]: makeSubmissionState(),
  },
  participant: makeParticipantState(),
  participantAfterIncrement: undefined,
  files: {
    [input.key]: photoBytes,
  },
  exif: {},
  parseResult: Effect.succeed({ Make: "Nikon", ISO: 200 }),
  resizeResult: Effect.succeed(thumbnailBytes),
  incrementStatus: "PROCESSED_SUBMISSION",
  s3Gets: [],
  increments: [],
  submissionUpdates: [],
  thumbnailPuts: [],
  finalizedEvents: [],
  ...overrides,
})

const updateTestState = (ref: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(ref, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const s3 = S3Service.of({
    getFile: (bucket: string, key: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          s3Gets: [...current.s3Gets, { bucket, key }],
        }))
        return Option.fromNullishOr(state.files[key])
      }),
    putFile: (bucket: string, key: string, file: Buffer) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        thumbnailPuts: [...state.thumbnailPuts, { bucket, key, file }],
      })).pipe(Effect.as({} as S3PutFileOutput)),
  } as unknown as S3Service["Service"])

  const uploadKv = UploadSessionRepository.of({
    getParticipantState: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const participant =
          state.increments.length > 0 && state.participantAfterIncrement !== undefined
            ? state.participantAfterIncrement
            : state.participant
        return Option.fromNullishOr(participant)
      }),
    getSubmissionState: (_domain: string, _reference: string, orderIndex: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.submissions[orderIndex])
      }),
    getAllSubmissionStates: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Object.values(state.submissions).filter(
          (submission): submission is SubmissionState => submission !== undefined,
        )
      }),
    incrementParticipantState: (_domain: string, _reference: string, orderIndex: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          increments: [...current.increments, orderIndex],
        }))
        return { status: state.incrementStatus }
      }),
    updateSubmissionSession: (
      _domain: string,
      _reference: string,
      orderIndex: number,
      submission: Partial<SubmissionState>,
    ) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        submissions: {
          ...state.submissions,
          [orderIndex]: {
            ...state.submissions[orderIndex],
            ...submission,
          } as SubmissionState,
        },
        submissionUpdates: [...state.submissionUpdates, { orderIndex, state: submission }],
      })).pipe(Effect.as(0)),
  } as unknown as UploadSessionRepository["Service"])

  const exifKv = ExifKVRepository.of({
    getExifState: (_domain: string, _reference: string, orderIndex: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.exif[orderIndex])
      }),
    setExifState: (_domain: string, _reference: string, orderIndex: number, exif: ExifState) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        exif: {
          ...state.exif,
          [orderIndex]: exif,
        },
      })).pipe(Effect.as("OK")),
  } as unknown as ExifKVRepository["Service"])

  const exifParser = ExifParser.of({
    parse: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return yield* state.parseResult
      }),
  } as unknown as ExifParser["Service"])

  const sharp = SharpImageService.of({
    resize: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return yield* state.resizeResult
      }),
  } as unknown as SharpImageService["Service"])

  const bus = BusService.of({
    sendFinalizedEvent: (domain: string, reference: string, finalizedUploadSessionId: string) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        finalizedEvents: [
          ...state.finalizedEvents,
          { domain, reference, uploadSessionId: finalizedUploadSessionId },
        ],
      })).pipe(Effect.as({} as BusSendFinalizedEventOutput)),
  } as BusService["Service"])

  const config = UploadsConfig.of({
    submissionsBucketName: "submissions",
    thumbnailsBucketName: "thumbnails",
    contactSheetsBucketName: "contact-sheets",
    zipsBucketName: "zips",
  })

  return UploadProcessorLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(S3Service)(s3),
        Layer.succeed(UploadSessionRepository)(uploadKv),
        Layer.succeed(ExifKVRepository)(exifKv),
        Layer.succeed(ExifParser)(exifParser),
        Layer.succeed(SharpImageService)(sharp),
        Layer.succeed(BusService)(bus),
        Layer.succeed(UploadsConfig)(config),
      ),
    ),
  )
}

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, SubmissionProcessor>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(makeTestLayer(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

describe("SubmissionProcessor", () => {
  it.effect("processes a ready submission and records artifacts", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const processor = yield* SubmissionProcessor
          yield* processor.process(input)
        }),
      )

      assert.deepStrictEqual(state.s3Gets, [{ bucket: "submissions", key: input.key }])
      assert.deepStrictEqual(state.exif[input.orderIndex], { Make: "Nikon", ISO: 200 })
      assert.deepStrictEqual(state.thumbnailPuts, [
        {
          bucket: "thumbnails",
          key: "demo/REF123/03/thumbnail_photo.jpg",
          file: thumbnailBytes,
        },
      ])
      assert.deepStrictEqual(state.submissionUpdates, [
        {
          orderIndex: input.orderIndex,
          state: {
            uploaded: true,
            orderIndex: input.orderIndex,
            thumbnailKey: "demo/REF123/03/thumbnail_photo.jpg",
            exifProcessed: true,
          },
        },
      ])
      assert.deepStrictEqual(state.increments, [input.orderIndex])
    }),
  )

  it.effect("merges seeded EXIF over parsed EXIF", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          exif: {
            [input.orderIndex]: {
              Make: "Seeded",
              Lens: "Prime",
            },
          },
          parseResult: Effect.succeed({
            Make: "Parsed",
            ISO: 400,
          }),
        }),
        () =>
          Effect.gen(function* () {
            const processor = yield* SubmissionProcessor
            yield* processor.process(input)
          }),
      )

      assert.deepStrictEqual(state.exif[input.orderIndex], {
        Make: "Seeded",
        ISO: 400,
        Lens: "Prime",
      })
    }),
  )

  it.effect("sends finalized event only after current-session finalization", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          incrementStatus: "FINALIZED",
        }),
        () =>
          Effect.gen(function* () {
            const processor = yield* SubmissionProcessor
            yield* processor.process(input)
          }),
      )

      assert.deepStrictEqual(state.finalizedEvents, [
        {
          domain: input.domain,
          reference: input.reference,
          uploadSessionId,
        },
      ])
    }),
  )

  it.effect("skips artifact work when the submission key is stale", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          submissions: {
            [input.orderIndex]: makeSubmissionState({ key: "demo/REF123/03/old.jpg" }),
          },
        }),
        () =>
          Effect.gen(function* () {
            const processor = yield* SubmissionProcessor
            yield* processor.process(input)
          }),
      )

      assert.deepStrictEqual(state.s3Gets, [])
      assert.deepStrictEqual(state.exif, {})
      assert.deepStrictEqual(state.thumbnailPuts, [])
      assert.deepStrictEqual(state.increments, [])
      assert.deepStrictEqual(state.finalizedEvents, [])
    }),
  )

  it.effect("fails with PhotoNotFoundError when S3 has no object", () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          files: {},
        }),
        () =>
          Effect.gen(function* () {
            const processor = yield* SubmissionProcessor
            return yield* Effect.flip(processor.process(input))
          }),
      )

      assert.instanceOf(error, PhotoNotFoundError)
      assert.strictEqual(error.key, input.key)
      assert.deepStrictEqual(state.increments, [])
      assert.deepStrictEqual(state.finalizedEvents, [])
    }),
  )

  it.effect("continues without thumbnail when resize fails", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          resizeResult: Effect.fail(new Error("resize failed")),
        }),
        () =>
          Effect.gen(function* () {
            const processor = yield* SubmissionProcessor
            yield* processor.process(input)
          }),
      )

      assert.deepStrictEqual(state.thumbnailPuts, [])
      assert.deepStrictEqual(state.submissionUpdates, [
        {
          orderIndex: input.orderIndex,
          state: {
            uploaded: true,
            orderIndex: input.orderIndex,
            thumbnailKey: null,
            exifProcessed: true,
          },
        },
      ])
      assert.deepStrictEqual(state.increments, [input.orderIndex])
    }),
  )

  it.effect("skips finalized event for stale participant after increment", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          incrementStatus: "FINALIZED",
          participantAfterIncrement: makeParticipantState({
            uploadSessionId: "stale-upload-session",
          }),
        }),
        () =>
          Effect.gen(function* () {
            const processor = yield* SubmissionProcessor
            yield* processor.process(input)
          }),
      )

      assert.deepStrictEqual(state.finalizedEvents, [])
    }),
  )
})
