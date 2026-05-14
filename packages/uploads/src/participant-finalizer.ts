import { Database, type NewSubmission, type Participant, type DbError } from "@blikka/db"
import {
  ExifKVRepository,
  type ExifKVRepositoryError,
  type ExifState,
  type ParticipantState,
  type SubmissionState,
  UploadSessionRepository,
  UploadSessionRepositoryError,
} from "@blikka/kv-store"
import { Context, Effect, Layer, Option, Schema } from "effect"

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
  "FailedToFinalizeParticipantError",
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

export interface UploadFinalizerShape {
  /**
   * Finalizes a participant after all submissions are processed.
   * Will update the participant status to "completed" and the submissions status to "uploaded".
   * This is the step to also trigger realtime completion event, but validation and other steps are not neccessarily completed at this point.
   */
  readonly finalize: (input: FinalizeParticipantInput) => Effect.Effect<void, UploadFinalizerError>
}

export class UploadFinalizer extends Context.Service<UploadFinalizer, UploadFinalizerShape>()(
  "@blikka/uploads/UploadFinalizer",
) {}

function shouldSkipFinalize({
  participant,
  participantState,
  uploadSessionId,
}: {
  readonly participant: Participant
  readonly participantState: ParticipantState
  readonly uploadSessionId: string
}): FinalizeSkipDecision {
  if (!participantState.finalized) {
    return {
      shouldSkip: true,
      message: "Participant kv state is not finalized; dropping stale finalize message",
    }
  }

  if (participantState.uploadSessionId !== uploadSessionId) {
    return {
      shouldSkip: true,
      message: "Dropping finalized event for non-current upload session",
    }
  }

  // In by-camera mode the same participant is reused. Should be reset when initialized but no need to be blocked either.
  if (participant.status === "completed" && participant.participantMode !== "by-camera") {
    return {
      shouldSkip: true,
      message: "Participant already completed, skipping",
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
    Omit<NewSubmission, "id" | "createdAt" | "updatedAt" | "participantId" | "marathonId">
  >
}[] {
  return submissionStates.map((state) => {
    const exif = exifStatesByOrderIndex.get(state.orderIndex) ?? {}

    return {
      orderIndex: state.orderIndex,
      data: {
        status: "uploaded" as const,
        thumbnailKey: state.thumbnailKey,
        exif,
        uploaded: state.uploaded,
      },
    }
  })
}

const makeUploadFinalizer = Effect.gen(function* () {
  const db = yield* Database
  const uploadKv = yield* UploadSessionRepository
  const exifKv = yield* ExifKVRepository

  const finalize: UploadFinalizerShape["finalize"] = Effect.fn(
    "UploadFinalizer.finalizeParticipant",
  )(
    function* ({ domain, reference, uploadSessionId }: FinalizeParticipantInput) {
      const participantStateOpt = yield* uploadKv.getParticipantState(domain, reference)
      if (Option.isNone(participantStateOpt)) {
        return yield* new FailedToFinalizeParticipantError({
          message: "Participant state not found",
        })
      }
      const participantOpt = yield* db.participantsQueries.getParticipantByReference({
        reference,
        domain,
      })
      if (Option.isNone(participantOpt)) {
        return yield* new FailedToFinalizeParticipantError({
          message: "Participant in db not found",
        })
      }

      const participant = participantOpt.value
      const participantState = participantStateOpt.value

      const skipDecision = shouldSkipFinalize({
        participant,
        participantState,
        uploadSessionId,
      })

      if (skipDecision.shouldSkip) {
        yield* Effect.logWarning(skipDecision.message)
        return
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
          message: "Submission states not found",
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
          "Missing EXIF state during upload finalization; continuing without EXIF",
          { missingExifOrderIndexes },
        )
      }

      const updates = buildSubmissionUpdates(submissionStates, exifStatesByOrderIndex)

      yield* db.submissionsQueries.updateAllSubmissions({ reference, domain, updates })
      yield* db.participantsQueries.updateParticipantByReference({
        reference,
        domain,
        data: { status: "completed" },
      })
    },
    (effect, input) => Effect.annotateLogs(effect, { ...input }),
  )

  return { finalize } satisfies UploadFinalizerShape
})

export const UploadFinalizerLayerNoDeps = Layer.effect(UploadFinalizer, makeUploadFinalizer)

export const UploadFinalizerLayer = UploadFinalizerLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(Database.layer, UploadSessionRepository.layer, ExifKVRepository.layer),
  ),
)
