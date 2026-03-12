import { Database } from "@blikka/db"
import { ExifKVRepository, UploadSessionRepository } from "@blikka/kv-store"
import { Effect, Layer, Option, Schema, ServiceMap } from "effect"

export class FailedToFinalizeParticipantError extends Schema.TaggedErrorClass<FailedToFinalizeParticipantError>()(
  "FailedToFinalizeParticipantError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export class UploadFinalizerService extends ServiceMap.Service<UploadFinalizerService>()(
  "@blikka/tasks/upload-finalizer/upload-finalizer-service",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const uploadKv = yield* UploadSessionRepository
      const exifKv = yield* ExifKVRepository

      const finalizeParticipant = Effect.fn("UploadFinalizerService.finalizeParticipant")(
        function* (domain: string, reference: string) {
          return yield* Effect.gen(function* () {
            const participantState = yield* uploadKv.getParticipantState(domain, reference)
            const participant = yield* db.participantsQueries.getParticipantByReference({
              reference,
              domain,
            })

            if (Option.isNone(participant)) {
              return yield* new FailedToFinalizeParticipantError({
                message: "Participant in db not found",
              })
            }

            if (Option.isNone(participantState)) {
              return yield* new FailedToFinalizeParticipantError({
                message: "Participant state not found",
              })
            }

            if (participant.value.status === "completed") {
              yield* Effect.logWarning("Participant already completed, skipping")
              return
            }

            const orderIndexes = [...participantState.value.orderIndexes]

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

            const exifStatesByOrderIndex = new Map(
              exifStates.map((state) => [state.orderIndex, state.exif] as const),
            )

            const missingExifOrderIndexes = submissionStates
              .filter(
                (state) =>
                  state.exifProcessed && !exifStatesByOrderIndex.has(state.orderIndex),
              )
              .map((state) => state.orderIndex)

            if (missingExifOrderIndexes.length > 0) {
              yield* Effect.logWarning("Missing EXIF state during upload finalization", {
                missingExifOrderIndexes,
              })
            }

            const updates = submissionStates.map((state) => {
              const exif = exifStatesByOrderIndex.get(state.orderIndex) ?? {}

              return {
                orderIndex: state.orderIndex,
                data: {
                  status: "uploaded" as const,
                  thumbnailKey: state.thumbnailKey,
                  exif: state.exifProcessed ? exif : {},
                  uploaded: state.uploaded,
                },
              }
            })

            yield* Effect.all(
              [
                db.submissionsQueries.updateAllSubmissions({
                  reference,
                  domain,
                  updates,
                }),
                db.participantsQueries.updateParticipantByReference({
                  reference,
                  domain,
                  data: {
                    status: "completed",
                  },
                }),
              ],
              { concurrency: 2 },
            )
          }).pipe(Effect.annotateLogs({ domain, reference }))
        },

        //TODO: release the upload session total lock here
      )

      return {
        finalizeParticipant,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(Database.layer, UploadSessionRepository.layer, ExifKVRepository.layer),
    ),
  )
}
