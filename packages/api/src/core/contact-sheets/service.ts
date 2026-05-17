import { ContactSheetBuilder, ContactSheetBuilderLayer } from "@blikka/image-manipulation"
import { Config, Effect, Layer, Option, Context } from "effect"
import {
  DbLayer,
  ContactSheetsRepository,
  ParticipantsRepository,
  TopicsRepository,
  SponsorsRepository,
  type CompetitionClass,
} from "@blikka/db"
import { S3Service, S3ServiceLayer } from "@blikka/aws"
import { ContactSheetApiError } from "./errors"

const VALID_PHOTO_COUNTS = [8, 24]

export class ContactSheetsService extends Context.Service<ContactSheetsService>()(
  "@blikka/api/contact-sheets-api-service",
  {
    make: Effect.gen(function* () {
      const sponsorsRepository = yield* SponsorsRepository
      const topicsRepository = yield* TopicsRepository
      const participantsRepository = yield* ParticipantsRepository
      const contactSheetsRepository = yield* ContactSheetsRepository
      const s3 = yield* S3Service
      const contactSheetBuilder = yield* ContactSheetBuilder
      const contactSheetsBucketName = yield* Config.string("CONTACT_SHEETS_BUCKET_NAME")
      const submissionsBucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")
      const sponsorsBucketName = yield* Config.string("SPONSORS_BUCKET_NAME")

      const generateContactSheetKey = (domain: string, reference: string) =>
        `${domain}/${reference}/contact_sheet_${reference}_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.jpg`

      const validatePhotoCount = Effect.fn("ContactSheetsService.validatePhotoCount")(function* (
        reference: string,
        domain: string,
        keys: string[],
        competitionClass: CompetitionClass | null,
      ) {
        if (!competitionClass?.numberOfPhotos) {
          return yield* Effect.fail(
            new ContactSheetApiError({
              message: `[${reference}|${domain}] Missing competition class photo count`,
            }),
          )
        }

        const expectedCount = competitionClass.numberOfPhotos
        if (!VALID_PHOTO_COUNTS.includes(expectedCount)) {
          return yield* Effect.fail(
            new ContactSheetApiError({
              message: `[${reference}|${domain}] Unsupported photo count ${expectedCount} for participant ${reference}`,
            }),
          )
        }

        if (keys.length !== expectedCount) {
          return yield* Effect.fail(
            new ContactSheetApiError({
              message: `[${reference}|${domain}] Photo count mismatch. Expected ${expectedCount}, got ${keys.length}`,
            }),
          )
        }
      })

      const generateContactSheet = Effect.fn("ContactSheetsService.generateContactSheet")(
        function* ({ domain, reference }) {
          const participant = yield* participantsRepository.getParticipantByReference({
            reference,
            domain,
          })

          if (Option.isNone(participant)) {
            return yield* Effect.fail(
              new ContactSheetApiError({
                message: "Participant not found",
              }),
            )
          }

          const submissions = participant.value.submissions || []
          if (submissions.length === 0) {
            return yield* Effect.fail(
              new ContactSheetApiError({
                message: "Participant has no submissions",
              }),
            )
          }

          yield* validatePhotoCount(
            reference,
            domain,
            submissions.map((s) => s.key),
            participant.value.competitionClass,
          )

          const sponsor = yield* sponsorsRepository.getLatestSponsorByType({
            marathonId: participant.value.marathonId,
            type: "contact-sheets",
          })

          const topics = yield* topicsRepository
            .getTopicsByDomain({
              domain,
            })
            .pipe(
              Effect.map((topics) =>
                topics.flatMap((t) => ({
                  name: t.name,
                  orderIndex: t.orderIndex,
                })),
              ),
            )

          const keys = submissions.map((s) => s.key)

          const contactSheetKey = generateContactSheetKey(domain, reference)

          const images = yield* Effect.forEach(
            submissions,
            (submission, index) =>
              Effect.gen(function* () {
                const file = yield* s3.getFile(submissionsBucketName, submission.key)
                if (Option.isNone(file)) {
                  return yield* Effect.fail(
                    new ContactSheetApiError({
                      message: `Submission image not found: ${submission.key}`,
                    }),
                  )
                }

                return {
                  orderIndex: index,
                  buffer: file.value,
                }
              }),
            { concurrency: 5 },
          )

          const sponsorImage = Option.isSome(sponsor)
            ? yield* Effect.gen(function* () {
                const file = yield* s3.getFile(sponsorsBucketName, sponsor.value.key)
                if (Option.isNone(file)) {
                  return yield* Effect.fail(
                    new ContactSheetApiError({
                      message: `Sponsor image not found: ${sponsor.value.key}`,
                    }),
                  )
                }

                return file.value
              })
            : undefined

          const contactSheetBuffer = yield* contactSheetBuilder.createSheet({
            reference,
            images,
            sponsorImage,
            sponsorPosition: "bottom-right",
            topics,
          })

          yield* s3.putFile(contactSheetsBucketName, contactSheetKey, contactSheetBuffer)

          yield* contactSheetsRepository.save({
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
        },
      )

      return {
        generateContactSheet,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(DbLayer, S3ServiceLayer, ContactSheetBuilderLayer)),
  )
}
