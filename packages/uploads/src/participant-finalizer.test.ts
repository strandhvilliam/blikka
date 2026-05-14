import { assert, describe, it } from "@effect/vitest"
import { Database } from "@blikka/db"
import {
  ExifKVRepository,
  type ExifState,
  type ParticipantState,
  type SubmissionState,
  UploadSessionRepository,
} from "@blikka/kv-store"
import { Effect, Layer, Option, Ref } from "effect"

import {
  FailedToFinalizeParticipantError,
  UploadFinalizer,
  UploadFinalizerLayer,
  type FinalizeParticipantInput,
} from "./participant-finalizer"

const uploadSessionId = "upload-session-1"
const input: FinalizeParticipantInput = {
  domain: "demo",
  reference: "REF123",
  uploadSessionId,
}

const submissionState: SubmissionState = {
  uploadSessionId,
  key: "demo/REF123/01/photo.jpg",
  orderIndex: 0,
  uploaded: true,
  thumbnailKey: "demo/REF123/01/thumbnail_photo.jpg",
  exifProcessed: true,
}

const makeParticipantState = (overrides: Partial<ParticipantState> = {}): ParticipantState => ({
  uploadSessionId,
  expectedCount: 1,
  orderIndexes: [0],
  processedIndexes: [0],
  validated: false,
  zipKey: "",
  contactSheetKey: "",
  errors: [],
  finalized: true,
  checkedAt: null,
  ...overrides,
})

interface TestParticipant {
  readonly status: "active" | "completed"
  readonly participantMode: "standard" | "by-camera"
}

interface TestState {
  readonly participant: TestParticipant | undefined
  readonly participantState: ParticipantState | undefined
  readonly submissionStates: readonly SubmissionState[]
  readonly exifStates: ReadonlyArray<{ orderIndex: number; exif: ExifState }>
  readonly submissionUpdates: ReadonlyArray<{
    domain: string
    reference: string
    updates: ReadonlyArray<{
      orderIndex: number
      data: {
        status: "uploaded"
        thumbnailKey: string | null
        exif: ExifState
        uploaded: boolean
      }
    }>
  }>
  readonly participantUpdates: ReadonlyArray<{
    domain: string
    reference: string
    data: { status: "completed" }
  }>
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  participant: {
    status: "active",
    participantMode: "standard",
  },
  participantState: makeParticipantState(),
  submissionStates: [submissionState],
  exifStates: [{ orderIndex: 0, exif: { Make: "Nikon" } }],
  submissionUpdates: [],
  participantUpdates: [],
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const db = Database.of({
    participantsQueries: {
      getParticipantByReference: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return Option.fromNullishOr(state.participant)
        }),
      updateParticipantByReference: ({
        domain,
        reference,
        data,
      }: {
        domain: string
        reference: string
        data: { status: "completed" }
      }) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          participantUpdates: [...state.participantUpdates, { domain, reference, data }],
        })).pipe(Effect.as(undefined)),
    },
    submissionsQueries: {
      updateAllSubmissions: ({
        domain,
        reference,
        updates,
      }: {
        domain: string
        reference: string
        updates: TestState["submissionUpdates"][number]["updates"]
      }) =>
        updateTestState(stateRef, (state) => ({
          ...state,
          submissionUpdates: [...state.submissionUpdates, { domain, reference, updates }],
        })).pipe(Effect.as(undefined)),
    },
  } as unknown as Database["Service"])

  const uploadKv = UploadSessionRepository.of({
    getParticipantState: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.participantState)
      }),
    getAllSubmissionStates: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return [...state.submissionStates]
      }),
  } as unknown as UploadSessionRepository["Service"])

  const exifKv = ExifKVRepository.of({
    getAllExifStates: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return [...state.exifStates]
      }),
  } as unknown as ExifKVRepository["Service"])

  return UploadFinalizerLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(Database)(db),
        Layer.succeed(UploadSessionRepository)(uploadKv),
        Layer.succeed(ExifKVRepository)(exifKv),
      ),
    ),
  )
}

const runWithState = <A, E>(
  state: TestState,
  effect: (stateRef: Ref.Ref<TestState>) => Effect.Effect<A, E, UploadFinalizer>,
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(state)
    const result = yield* effect(stateRef).pipe(Effect.provide(makeTestLayer(stateRef)))
    const finalState = yield* Ref.get(stateRef)
    return { result, state: finalState }
  })

describe("UploadFinalizer", () => {
  it.effect("finalizes current-session submissions and marks participant completed", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(makeInitialState(), () =>
        Effect.gen(function* () {
          const finalizer = yield* UploadFinalizer
          yield* finalizer.finalize(input)
        }),
      )

      assert.deepStrictEqual(state.submissionUpdates, [
        {
          domain: input.domain,
          reference: input.reference,
          updates: [
            {
              orderIndex: submissionState.orderIndex,
              data: {
                status: "uploaded",
                thumbnailKey: submissionState.thumbnailKey,
                exif: { Make: "Nikon" },
                uploaded: true,
              },
            },
          ],
        },
      ])
      assert.deepStrictEqual(state.participantUpdates, [
        {
          domain: input.domain,
          reference: input.reference,
          data: { status: "completed" },
        },
      ])
    }),
  )

  it.effect("skips stale upload-session finalization events", () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          participantState: makeParticipantState({
            uploadSessionId: "new-session",
          }),
        }),
        () =>
          Effect.gen(function* () {
            const finalizer = yield* UploadFinalizer
            yield* finalizer.finalize(input)
          }),
      )

      assert.deepStrictEqual(state.submissionUpdates, [])
      assert.deepStrictEqual(state.participantUpdates, [])
    }),
  )

  it.effect("fails when participant state is missing", () =>
    Effect.gen(function* () {
      const { result: error, state } = yield* runWithState(
        makeInitialState({
          participantState: undefined,
        }),
        () =>
          Effect.gen(function* () {
            const finalizer = yield* UploadFinalizer
            return yield* Effect.flip(finalizer.finalize(input))
          }),
      )

      assert.instanceOf(error, FailedToFinalizeParticipantError)
      assert.strictEqual(error.message, "Participant state not found")
      assert.deepStrictEqual(state.submissionUpdates, [])
      assert.deepStrictEqual(state.participantUpdates, [])
    }),
  )
})
