import { ContactSheetBuilder } from "@blikka/image-manipulation"
import { Config, Effect, Option } from "effect"
import { type CompetitionClass, Database } from "@blikka/db"
import { S3Service } from "@blikka/s3"
import { ContactSheetApiError } from "./schemas"

const VALID_PHOTO_COUNTS = [8, 24]

export class ContactSheetsApiService extends Effect.Service<ContactSheetsApiService>()(
  "@blikka/api/contact-sheets-api-service",
  {
    accessors: true,
    dependencies: [Database.Default, S3Service.Default, ContactSheetBuilder.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database
      const s3 = yield* S3Service
      const contactSheetBuilder = yield* ContactSheetBuilder
      const contactSheetsBucketName = yield* Config.string("CONTACT_SHEETS_BUCKET_NAME")

      const generateContactSheetKey = (domain: string, reference: string) =>
        `${domain}/${reference}/contact_sheet_${reference}_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.jpg`

      const validatePhotoCount = Effect.fn("ContactSheetsApiService.validatePhotoCount")(function* (
        reference: string,
        domain: string,
        keys: string[],
        competitionClass: CompetitionClass | null
      ) {
        if (!competitionClass?.numberOfPhotos) {
          return yield* Effect.fail(
            new ContactSheetApiError({
              message: `[${reference}|${domain}] Missing competition class photo count`,
            })
          )
        }

        const expectedCount = competitionClass.numberOfPhotos
        if (!VALID_PHOTO_COUNTS.includes(expectedCount)) {
          return yield* Effect.fail(
            new ContactSheetApiError({
              message: `[${reference}|${domain}] Unsupported photo count ${expectedCount} for participant ${reference}`,
            })
          )
        }

        if (keys.length !== expectedCount) {
          return yield* Effect.fail(
            new ContactSheetApiError({
              message: `[${reference}|${domain}] Photo count mismatch. Expected ${expectedCount}, got ${keys.length}`,
            })
          )
        }
      })

      const generateContactSheet = Effect.fn("ContactSheetsApiService.generateContactSheet")(
        function* ({ domain, reference }) {
          const participant = yield* db.participantsQueries.getParticipantByReference({
            reference,
            domain,
          })

          if (Option.isNone(participant)) {
            return yield* Effect.fail(
              new ContactSheetApiError({
                message: "Participant not found",
              })
            )
          }

          const submissions = participant.value.submissions || []
          if (submissions.length === 0) {
            return yield* Effect.fail(
              new ContactSheetApiError({
                message: "Participant has no submissions",
              })
            )
          }

          yield* validatePhotoCount(
            reference,
            domain,
            submissions.map((s) => s.key),
            participant.value.competitionClass
          )

          const sponsor = yield* db.sponsorsQueries.getLatestSponsorByType({
            marathonId: participant.value.marathonId,
            type: "contact-sheets",
          })

          const topics = yield* db.topicsQueries
            .getTopicsByDomain({
              domain,
            })
            .pipe(
              Effect.map((topics) =>
                topics.flatMap((t) => ({
                  name: t.name,
                  orderIndex: t.orderIndex,
                }))
              )
            )

          const keys = submissions.map((s) => s.key)

          const contactSheetKey = generateContactSheetKey(domain, reference)

          const contactSheetBuffer = yield* contactSheetBuilder.createSheet({
            domain,
            reference,
            keys,
            sponsorKey: Option.isSome(sponsor) ? sponsor.value.key : undefined,
            sponsorPosition: "bottom-right",
            topics,
          })

          yield* s3.putFile(contactSheetsBucketName, contactSheetKey, contactSheetBuffer)

          yield* db.contactSheetsQueries.save({
            data: {
              key: contactSheetKey,
              participantId: participant.value.id,
              marathonId: participant.value.marathonId,
            },
          })

          return {
            success: true,
            key: contactSheetKey,
          }
        }
      )

      return {
        generateContactSheet,
      } as const
    }),
  }
) {}
