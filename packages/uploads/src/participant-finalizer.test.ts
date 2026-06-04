import { assert, describe, it } from '@effect/vitest'
import { MarathonsRepository, ParticipantsRepository, SubmissionsRepository } from '@blikka/db'
import {
  ExifKVRepository,
  type ExifState,
  type ParticipantState,
  type SubmissionState,
  UploadSessionRepository,
} from '@blikka/kv-store'
import { Effect, Layer, Option, Ref } from 'effect'

import {
  FailedToFinalizeParticipantError,
  UploadFinalizer,
  UploadFinalizerLayerNoDeps,
  type FinalizeParticipantInput,
} from './participant-finalizer'

const uploadSessionId = 'upload-session-1'
const input: FinalizeParticipantInput = {
  domain: 'demo',
  reference: 'REF123',
  uploadSessionId,
}

const submissionState: SubmissionState = {
  uploadSessionId,
  key: 'demo/REF123/01/photo.jpg',
  orderIndex: 0,
  uploaded: true,
  thumbnailKey: 'demo/REF123/01/thumbnail_photo.jpg',
  exifProcessed: true,
}

const makeParticipantState = (overrides: Partial<ParticipantState> = {}): ParticipantState => ({
  uploadSessionId,
  expectedCount: 1,
  orderIndexes: [0],
  processedIndexes: [0],
  validated: false,
  zipKey: '',
  contactSheetKey: '',
  errors: [],
  finalized: true,
  checkedAt: null,
  ...overrides,
})

interface TestParticipant {
  readonly status: 'active' | 'completed' | 'verified'
  readonly participantMode: 'standard' | 'by-camera'
}

interface TestState {
  readonly participant: TestParticipant | undefined
  readonly participantState: ParticipantState | undefined
  readonly participantStateAfterSubmissionUpdate: ParticipantState | undefined
  readonly submissionStates: readonly SubmissionState[]
  readonly exifStates: ReadonlyArray<{ orderIndex: number; exif: ExifState }>
  readonly submissionUpdates: ReadonlyArray<{
    domain: string
    reference: string
    updates: ReadonlyArray<{
      orderIndex: number
      data: {
        status: 'uploaded'
        thumbnailKey: string | null
        exif: ExifState
        uploaded: boolean
      }
    }>
  }>
  readonly participantUpdates: ReadonlyArray<{
    domain: string
    reference: string
    canMarkCompleted: boolean
    verificationMode: 'all' | 'flagged' | 'none'
    validationDecision: 'pending' | 'passed' | 'flagged' | null | undefined
    status: 'completed' | 'verified' | null
  }>
  readonly marathon: { mode: string; verificationMode: string } | undefined
}

const makeInitialState = (overrides: Partial<TestState> = {}): TestState => ({
  participant: {
    status: 'active',
    participantMode: 'standard',
  },
  participantState: makeParticipantState(),
  participantStateAfterSubmissionUpdate: undefined,
  submissionStates: [submissionState],
  exifStates: [{ orderIndex: 0, exif: { Make: 'Nikon' } }],
  submissionUpdates: [],
  participantUpdates: [],
  marathon: { mode: 'marathon', verificationMode: 'all' },
  ...overrides,
})

const updateTestState = (stateRef: Ref.Ref<TestState>, f: (state: TestState) => TestState) =>
  Ref.update(stateRef, f)

const makeTestLayer = (stateRef: Ref.Ref<TestState>) => {
  const participantsRepository = ParticipantsRepository.of({
    getParticipantByReference: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.participant)
      }),
    settleFinalizedParticipantStatus: ({
      domain,
      reference,
      canMarkCompleted,
      verificationMode,
      validationDecision,
    }: {
      domain: string
      reference: string
      canMarkCompleted: boolean
      verificationMode: 'all' | 'flagged' | 'none'
      validationDecision: 'pending' | 'passed' | 'flagged' | null | undefined
    }) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (state.participant?.status === 'verified') {
          return {
            changed: false,
            changedToVerified: false,
            status: null,
          }
        }
        const shouldVerify = verificationMode === 'flagged' && validationDecision === 'passed'
        const status = shouldVerify ? 'verified' : canMarkCompleted ? 'completed' : null
        yield* updateTestState(stateRef, (current) => ({
          ...current,
          participantUpdates: [
            ...current.participantUpdates,
            {
              domain,
              reference,
              canMarkCompleted,
              verificationMode,
              validationDecision,
              status,
            },
          ],
          participant:
            current.participant && status
              ? { ...current.participant, status }
              : current.participant,
        }))
        return {
          changed: state.participant?.status !== status,
          changedToVerified: status === 'verified',
          status,
        }
      }),
  } as unknown as ParticipantsRepository['Service'])

  const marathonsRepository = MarathonsRepository.of({
    getMarathonByDomain: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Option.fromNullishOr(state.marathon)
      }),
  } as unknown as MarathonsRepository['Service'])

  const submissionsRepository = SubmissionsRepository.of({
    updateAllSubmissions: ({
      domain,
      reference,
      updates,
    }: {
      domain: string
      reference: string
      updates: TestState['submissionUpdates'][number]['updates']
    }) =>
      updateTestState(stateRef, (state) => ({
        ...state,
        submissionUpdates: [...state.submissionUpdates, { domain, reference, updates }],
        participantState: state.participantStateAfterSubmissionUpdate ?? state.participantState,
      })).pipe(Effect.as(undefined)),
  } as unknown as SubmissionsRepository['Service'])

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
  } as unknown as UploadSessionRepository['Service'])

  const exifKv = ExifKVRepository.of({
    getAllExifStates: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return [...state.exifStates]
      }),
  } as unknown as ExifKVRepository['Service'])

  return UploadFinalizerLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ParticipantsRepository)(participantsRepository),
        Layer.succeed(MarathonsRepository)(marathonsRepository),
        Layer.succeed(SubmissionsRepository)(submissionsRepository),
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

describe('UploadFinalizer', () => {
  it.effect('finalizes current-session submissions and marks participant completed', () =>
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
                status: 'uploaded',
                thumbnailKey: submissionState.thumbnailKey,
                exif: { Make: 'Nikon' },
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
          canMarkCompleted: true,
          verificationMode: 'all',
          validationDecision: null,
          status: 'completed',
        },
        {
          domain: input.domain,
          reference: input.reference,
          canMarkCompleted: true,
          verificationMode: 'all',
          validationDecision: null,
          status: 'completed',
        },
      ])
    }),
  )

  it.effect('auto-verifies flagged marathon participants with passed validation', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(
        makeInitialState({
          marathon: { mode: 'marathon', verificationMode: 'flagged' },
          participantState: makeParticipantState({ validationDecision: 'passed' }),
        }),
        () =>
          Effect.gen(function* () {
            const finalizer = yield* UploadFinalizer
            return yield* finalizer.finalize(input)
          }),
      )

      assert.strictEqual(result.changedToVerified, true)
      assert.deepStrictEqual(
        state.participantUpdates.map((update) => update.status),
        ['verified'],
      )
    }),
  )

  it.effect('preserves already verified participants during finalization', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(
        makeInitialState({
          participant: {
            status: 'verified',
            participantMode: 'standard',
          },
          marathon: { mode: 'marathon', verificationMode: 'flagged' },
          participantState: makeParticipantState({ validationDecision: 'flagged' }),
        }),
        () =>
          Effect.gen(function* () {
            const finalizer = yield* UploadFinalizer
            return yield* finalizer.finalize(input)
          }),
      )

      assert.strictEqual(result.changedToVerified, false)
      assert.strictEqual(state.participant?.status, 'verified')
    }),
  )

  it.effect('does not settle status when the active upload session changes mid-finalization', () =>
    Effect.gen(function* () {
      const { result, state } = yield* runWithState(
        makeInitialState({
          participantStateAfterSubmissionUpdate: makeParticipantState({
            uploadSessionId: 'new-session',
            validationDecision: 'passed',
          }),
          marathon: { mode: 'marathon', verificationMode: 'flagged' },
        }),
        () =>
          Effect.gen(function* () {
            const finalizer = yield* UploadFinalizer
            return yield* finalizer.finalize(input)
          }),
      )

      assert.strictEqual(result.changed, false)
      assert.deepStrictEqual(state.participantUpdates, [])
    }),
  )

  it.effect('skips stale upload-session finalization events', () =>
    Effect.gen(function* () {
      const { state } = yield* runWithState(
        makeInitialState({
          participantState: makeParticipantState({
            uploadSessionId: 'new-session',
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

  it.effect('fails when participant state is missing', () =>
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
      assert.strictEqual(error.message, 'Participant state not found')
      assert.deepStrictEqual(state.submissionUpdates, [])
      assert.deepStrictEqual(state.participantUpdates, [])
    }),
  )
})
