import { Effect, Option } from "effect"
import { SheetBuilder } from "./sheet-builder"
import { Database } from "@blikka/db"
import { UploadSessionRepository } from "@blikka/kv-store"
import { S3Service } from "@blikka/s3"
import { Resource as SSTResource } from "sst"
import {
  ensureReadyForSheetGeneration,
  generateContactSheetKey,
  InvalidSheetGenerationData,
  validatePhotoCount,
} from "./utils"

export class SheetGeneratorService extends Effect.Service<SheetGeneratorService>()(
  "@blikka/contact-sheet-generator/sheet-generator-service",
  {
    dependencies: [
      SheetBuilder.Default,
      Database.Default,
      UploadSessionRepository.Default,
      S3Service.Default,
    ],
    effect: Effect.gen(function* () {
      const sheetBuilder = yield* SheetBuilder
      const db = yield* Database
      const kvStore = yield* UploadSessionRepository
      const s3 = yield* S3Service

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

          yield* sheetBuilder
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
                s3.putFile(
                  SSTResource.V2ContactSheetsBucket.name,
                  generateContactSheetKey(params.domain, params.reference),
                  buffer
                )
              )
            )

          const contactSheetKey = generateContactSheetKey(params.domain, params.reference)

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
      }
    }),
  }
) {}
