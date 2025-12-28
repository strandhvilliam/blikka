import { Database } from "@blikka/db"
import { ExifKVRepository, UploadSessionRepository } from "@blikka/kv-store"
import { Effect, Option, Schema } from "effect"

export class FailedToFinalizeParticipantError extends Schema.TaggedError<FailedToFinalizeParticipantError>()(
  "FailedToFinalizeParticipantError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class UploadFinalizerService extends Effect.Service<UploadFinalizerService>()(
  "@blikka/tasks/UploadFinalizerService",
  {
    dependencies: [Database.Default, UploadSessionRepository.Default, ExifKVRepository.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database
      const uploadKv = yield* UploadSessionRepository
      const exifKv = yield* ExifKVRepository

      const finalizeParticipant = Effect.fn("UploadFinalizerService.finalizeParticipant")(
        function* (domain: string, reference: string) {
          const participantState = yield* uploadKv.getParticipantState(domain, reference)
          const participant = yield* db.participantsQueries.getParticipantByReference({
            reference,
            domain,
          })

          if (Option.isNone(participant)) {
            return yield* new FailedToFinalizeParticipantError({
              message: `[${reference}|${domain}] Participant in db not found`,
            })
          }

          if (Option.isNone(participantState)) {
            return yield* new FailedToFinalizeParticipantError({
              message: `[${reference}|${domain}] Participant state not found`,
            })
          }

          if (participant.value.status === "completed") {
            yield* Effect.logWarning(
              `[${reference}|${domain}] Participant already completed, skipping`
            )
            return
          }

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
                  status: "completed",
                },
              }),
            ],
            { concurrency: 2 }
          )
        }

        //TODO: release the upload session total lock here
      )

      return {
        finalizeParticipant,
      } as const
    }),
  }
) {}
