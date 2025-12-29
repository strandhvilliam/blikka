import { Config, Effect, Option } from "effect"
import { Database } from "@blikka/db"
import { UploadSessionRepository } from "@blikka/kv-store"
import { S3Service } from "@blikka/s3"
import {
  ensureReadyForSheetGeneration,
  generateContactSheetKey,
  InvalidSheetGenerationData,
  validatePhotoCount,
} from "./utils"
import { ContactSheetBuilder } from "@blikka/image-manipulation"

export class SheetGeneratorService extends Effect.Service<SheetGeneratorService>()(
  "@blikka/contact-sheet-generator/sheet-generator-service",
  {
    dependencies: [
      Database.Default,
      UploadSessionRepository.Default,
      S3Service.Default,
      ContactSheetBuilder.Default,
    ],
    effect: Effect.gen(function* () {
      const db = yield* Database
      const kvStore = yield* UploadSessionRepository
      const s3 = yield* S3Service
      const contactSheetsBucketName = yield* Config.string("CONTACT_SHEETS_BUCKET_NAME")
      const contactSheetBuilder = yield* ContactSheetBuilder

      const generateContactSheet = Effect.fn("SheetGeneratorService.generateContactSheet")(
        function* (params: { domain: string; reference: string }) {
          const participantState = yield* kvStore
            .getParticipantState(params.domain, params.reference)
            .pipe(
              Effect.andThen(
                Option.match({
                  onSome: (participantState) => Effect.succeed(participantState),
                  onNone: () =>
                    Effect.fail(
                      new InvalidSheetGenerationData({
                        message: `[${params.reference}|${params.domain}] Participant state not found`,
                      })
                    ),
                })
              )
            )

          const { shouldSkip } = yield* ensureReadyForSheetGeneration(
            participantState,
            params.reference,
            params.domain
          )

          if (shouldSkip) {
            return yield* Effect.log(
              `Skipping contact sheet generation for reference ${params.reference} and domain ${params.domain}`
            )
          }

          const participant = yield* db.participantsQueries
            .getParticipantByReference({
              reference: params.reference,
              domain: params.domain,
            })
            .pipe(
              Effect.andThen(
                Option.match({
                  onSome: (participant) => Effect.succeed(participant),
                  onNone: () =>
                    Effect.fail(
                      new InvalidSheetGenerationData({
                        message: `[${params.reference}|${params.domain}] Participant not found`,
                      })
                    ),
                })
              )
            )

          const sponsor = yield* db.sponsorsQueries.getLatestSponsorByType({
            marathonId: participant.marathonId,
            type: "contact-sheets",
          })

          const topics = yield* db.topicsQueries
            .getTopicsByDomain({
              domain: params.domain,
            })
            .pipe(
              Effect.map((topics) =>
                topics.flatMap((t) => ({
                  name: t.name,
                  orderIndex: t.orderIndex,
                }))
              )
            )

          const keys = participant.submissions.map((s) => s.key)

          yield* validatePhotoCount(
            params.reference,
            params.domain,
            keys,
            participant.competitionClass
          )

          const contactSheetKey = generateContactSheetKey(params.domain, params.reference)

          yield* contactSheetBuilder
            .createSheet({
              domain: params.domain,
              reference: params.reference,
              keys,
              sponsorKey: Option.isSome(sponsor) ? sponsor.value.key : undefined,
              sponsorPosition: "bottom-right",
              topics,
            })
            .pipe(
              Effect.andThen((buffer) =>
                s3.putFile(contactSheetsBucketName, contactSheetKey, buffer)
              )
            )

          yield* Effect.all(
            [
              kvStore.updateParticipantSession(params.domain, params.reference, {
                contactSheetKey,
              }),
              db.contactSheetsQueries.save({
                data: {
                  key: contactSheetKey,
                  participantId: participant.id,
                  marathonId: participant.marathonId,
                },
              }),
            ],
            { concurrency: 2 }
          )
        }
      )

      return {
        generateContactSheet,
      } as const
    }),
  }
) {}
