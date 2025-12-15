import { Database } from "@blikka/db"
import { ExifKVRepository, UploadKVRepository } from "@blikka/kv-store"
import { Data, Effect, Option } from "effect"

export class FailedToFinalizeParticipantError extends Data.TaggedError(
  "FailedToFinalizeParticipantError"
)<{
  message?: string
  cause?: unknown
}> {}

export class UploadFinalizerService extends Effect.Service<UploadFinalizerService>()(
  "@blikka/tasks/UploadFinalizerService",
  {
    dependencies: [Database.Default, UploadKVRepository.Default, ExifKVRepository.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database
      const uploadKv = yield* UploadKVRepository
      const exifKv = yield* ExifKVRepository

      const finalizeParticipant = Effect.fn("UploadFinalizerService.finalizeParticipant")(
        function* (domain: string, reference: string) {
          const participantState = yield* uploadKv.getParticipantState(domain, reference)

          if (Option.isNone(participantState)) {
            return yield* new FailedToFinalizeParticipantError({
              message: "Participant state not found",
            })
          }

          const uploadCount = participantState.value.processedIndexes.filter((v) => v !== 0).length
          const orderIndexes = participantState.value.processedIndexes.map((_, i) => i)

          const [submissionStates, exifStates] = yield* Effect.all(
            [
              uploadKv.getAllSubmissionStates(domain, reference, orderIndexes),
              exifKv.getAllExifStates(domain, reference, orderIndexes),
            ],
            { concurrency: 2 }
          )

          if (submissionStates.length === 0 || exifStates.length === 0) {
            return yield* new FailedToFinalizeParticipantError({
              message: "Submission states or exif states not found",
            })
          }

          const updates = submissionStates.map((state) => {
            const exif = exifStates.find((e) => e.orderIndex === state.orderIndex)?.exif ?? {}

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
                  uploadCount,
                  status: "completed",
                },
              }),
            ],
            { concurrency: 2 }
          )
        }
      )

      return {
        finalizeParticipant,
      } as const
    }),
  }
) {}
