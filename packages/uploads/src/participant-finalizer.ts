import {
  DbLayer,
  MarathonsRepository,
  ParticipantsRepository,
  SubmissionsRepository,
  type NewSubmission,
  type DbError,
  type ParticipantStatusTransitionResult,
} from '@blikka/db'
import {
  ExifKVRepository,
  ExifKVRepositoryLayer,
  type ExifKVRepositoryError,
  type ExifState,
  type ParticipantState,
  type SubmissionState,
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
  type UploadSessionRepositoryError,
} from '@blikka/kv-store'
import { Context, Effect, Layer, Option, Schema } from 'effect'
import { resolveMarathonVerificationMode } from './flagged-verification-flow'

export interface FinalizeParticipantInput {
  readonly domain: string
  readonly reference: string
  readonly uploadSessionId: string
}

type FinalizeSkipDecision =
  | {
      readonly shouldSkip: true
      readonly message: string
    }
  | {
      readonly shouldSkip: false
    }

export class FailedToFinalizeParticipantError extends Schema.TaggedErrorClass<FailedToFinalizeParticipantError>()(
  'FailedToFinalizeParticipantError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type UploadFinalizerError =
  | FailedToFinalizeParticipantError
  | UploadSessionRepositoryError
  | ExifKVRepositoryError
  | DbError

export class UploadFinalizer extends Context.Service<
  UploadFinalizer,
  {
    /**
     * Finalizes a participant after all submissions are processed: writes submission rows, then
     * settles DB status (typically `completed`, or auto-`verified` in flagged mode when validation
     * already wrote `passed` to KV). Validation may still be in flight; see `flagged-verification-flow`.
     */
    readonly finalize: (
      input: FinalizeParticipantInput,
    ) => Effect.Effect<ParticipantStatusTransitionResult, UploadFinalizerError>
  }
>()('@blikka/uploads/UploadFinalizer') {}

const unchangedStatusTransition: ParticipantStatusTransitionResult = {
  changed: false,
  changedToVerified: false,
  status: null,
}

function shouldSkipFinalize({
  participantState,
  uploadSessionId,
}: {
  readonly participantState: ParticipantState
  readonly uploadSessionId: string
}): FinalizeSkipDecision {
  if (!participantState.finalized) {
    return {
      shouldSkip: true,
      message: 'Participant kv state is not finalized; dropping stale finalize message',
    }
  }

  if (participantState.uploadSessionId !== uploadSessionId) {
    return {
      shouldSkip: true,
      message: 'Dropping finalized event for non-current upload session',
    }
  }

  return { shouldSkip: false }
}

function buildSubmissionUpdates(
  submissionStates: readonly SubmissionState[],
  exifStatesByOrderIndex: ReadonlyMap<number, ExifState>,
): {
  orderIndex: number
  data: Partial<
    Omit<NewSubmission, 'id' | 'createdAt' | 'updatedAt' | 'participantId' | 'marathonId'>
  >
}[] {
  return submissionStates.map((state) => {
    const exif = exifStatesByOrderIndex.get(state.orderIndex) ?? {}

    return {
      orderIndex: state.orderIndex,
      data: {
        status: 'uploaded' as const,
        thumbnailKey: state.thumbnailKey,
        exif,
        uploaded: state.uploaded,
      },
    }
  })
}

const makeUploadFinalizer = Effect.gen(function* () {
  const submissionsRepository = yield* SubmissionsRepository
  const participantsRepository = yield* ParticipantsRepository
  const marathonsRepository = yield* MarathonsRepository
  const uploadKv = yield* UploadSessionRepository
  const exifKv = yield* ExifKVRepository

  const getVerificationMode = Effect.fnUntraced(function* (domain: string) {
    const marathon = yield* marathonsRepository.getMarathonByDomain({ domain })
    return Option.match(marathon, {
      onNone: () => resolveMarathonVerificationMode(undefined),
      onSome: (value) => resolveMarathonVerificationMode(value),
    })
  })

  /** Re-reads KV for the current session, then `settleFinalizedParticipantStatus` with `canMarkCompleted: true`. */
  const settleStatus = Effect.fnUntraced(function* ({
    domain,
    reference,
    uploadSessionId,
  }: {
    domain: string
    reference: string
    uploadSessionId: string
  }) {
    const [verificationMode, latestParticipantStateOpt] = yield* Effect.all(
      [getVerificationMode(domain), uploadKv.getParticipantState(domain, reference)],
      { concurrency: 2 },
    )
    const validationDecision = Option.match(latestParticipantStateOpt, {
      onNone: () => null,
      onSome: (state) => {
        if (state.uploadSessionId !== uploadSessionId) {
          return undefined
        }
        return state.validationDecision ?? null
      },
    })

    if (validationDecision === undefined) {
      yield* Effect.logWarning('Skipping status transition for stale upload session')
      return unchangedStatusTransition
    }

    return yield* participantsRepository.settleFinalizedParticipantStatus({
      reference,
      domain,
      canMarkCompleted: true,
      verificationMode,
      validationDecision,
    })
  })

  const finalize = Effect.fn('UploadFinalizer.finalizeParticipant')(
    function* ({ domain, reference, uploadSessionId }: FinalizeParticipantInput) {
      // Set from inside the body via annotateCurrentSpan so they land on the finalize span itself —
      // a trailing Effect.fn transform (annotateSpans) only annotates child spans, not this span.
      yield* Effect.annotateCurrentSpan({
        'blikka.domain': domain,
        'blikka.reference': reference,
        'blikka.upload_session_id': uploadSessionId,
      })
      const participantStateOpt = yield* uploadKv.getParticipantState(domain, reference)
      if (Option.isNone(participantStateOpt)) {
        return yield* new FailedToFinalizeParticipantError({
          message: 'Participant state not found',
        })
      }
      const participantOpt = yield* participantsRepository.getParticipantByReference({
        reference,
        domain,
      })
      if (Option.isNone(participantOpt)) {
        return yield* new FailedToFinalizeParticipantError({
          message: 'Participant in db not found',
        })
      }

      const participantState = participantStateOpt.value

      const skipDecision = shouldSkipFinalize({
        participantState,
        uploadSessionId,
      })

      if (skipDecision.shouldSkip) {
        yield* Effect.logWarning(skipDecision.message)
        return unchangedStatusTransition
      }

      const orderIndexes = [...participantState.orderIndexes]
      const [submissionStates, exifStates] = yield* Effect.all(
        [
          uploadKv.getAllSubmissionStates(domain, reference, orderIndexes),
          exifKv.getAllExifStates(domain, reference, orderIndexes),
        ],
        { concurrency: 2 },
      )

      if (submissionStates.length === 0) {
        return yield* new FailedToFinalizeParticipantError({
          message: 'Submission states not found',
        })
      }

      if (submissionStates.length !== orderIndexes.length) {
        return yield* new FailedToFinalizeParticipantError({
          message: `Submission states length mismatch: expected ${orderIndexes.length} but got ${submissionStates.length}`,
        })
      }

      const exifStatesByOrderIndex = new Map(
        exifStates.map((state) => [state.orderIndex, state.exif] as const),
      )

      const missingExifOrderIndexes = submissionStates
        .filter((state) => !exifStatesByOrderIndex.has(state.orderIndex))
        .map((state) => state.orderIndex)

      if (missingExifOrderIndexes.length > 0) {
        yield* Effect.logWarning(
          'Missing EXIF state during upload finalization; continuing without EXIF',
          { missingExifOrderIndexes },
        )
      }

      const updates = buildSubmissionUpdates(submissionStates, exifStatesByOrderIndex)

      yield* submissionsRepository.updateAllSubmissions({
        reference,
        domain,
        updates,
      })

      // Two passes so a concurrent validation finishing with `passed` can trigger auto-verify here.
      const firstTransition = yield* settleStatus({
        reference,
        domain,
        uploadSessionId,
      })
      const secondTransition = yield* settleStatus({
        reference,
        domain,
        uploadSessionId,
      })

      return {
        changed: firstTransition.changed || secondTransition.changed,
        changedToVerified: firstTransition.changedToVerified || secondTransition.changedToVerified,
        status: secondTransition.status ?? firstTransition.status,
      }
    },
    (effect, input) => Effect.annotateLogs(effect, { ...input }),
  )

  return UploadFinalizer.of({ finalize })
})

export const UploadFinalizerLayerNoDeps = Layer.effect(UploadFinalizer, makeUploadFinalizer)

export const UploadFinalizerLayer = UploadFinalizerLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DbLayer, UploadSessionRepositoryLayer, ExifKVRepositoryLayer)),
)
