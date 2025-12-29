import { authProcedure, createTRPCRouter } from "../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../utils"
import { Config, Schema, Effect, Option } from "effect"
import { Database, type CompetitionClass } from "@blikka/db"
import { S3Service } from "@blikka/s3"
import { ContactSheetBuilder } from "@blikka/image-manipulation"
import { TRPCError } from "@trpc/server"

const VALID_PHOTO_COUNTS = [8, 24]

class InvalidSheetGenerationData extends Schema.TaggedError<InvalidSheetGenerationData>()(
  "InvalidSheetGenerationData",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

const generateContactSheetKey = (domain: string, reference: string) =>
  `${domain}/${reference}/contact_sheet_${reference}_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.jpg`

const validatePhotoCount = Effect.fn("ContactSheetsRouter.validatePhotoCount")(function* (
  reference: string,
  domain: string,
  keys: string[],
  competitionClass: CompetitionClass | null
) {
  if (!competitionClass?.numberOfPhotos) {
    return yield* Effect.fail(
      new InvalidSheetGenerationData({
        message: `[${reference}|${domain}] Missing competition class photo count`,
      })
    )
  }

  const expectedCount = competitionClass.numberOfPhotos
  if (!VALID_PHOTO_COUNTS.includes(expectedCount)) {
    return yield* Effect.fail(
      new InvalidSheetGenerationData({
        message: `[${reference}|${domain}] Unsupported photo count ${expectedCount} for participant ${reference}`,
      })
    )
  }

  if (keys.length !== expectedCount) {
    return yield* Effect.fail(
      new InvalidSheetGenerationData({
        message: `[${reference}|${domain}] Photo count mismatch. Expected ${expectedCount}, got ${keys.length}`,
      })
    )
  }
})

export const contactSheetsRouter = createTRPCRouter({
  generateContactSheet: authProcedure
    .input(
      Schema.standardSchemaV1(
        Schema.Struct({
          domain: Schema.String,
          reference: Schema.String,
        })
      )
    )
    .mutation(
      trpcEffect(
        Effect.fn("ContactSheetsRouter.generateContactSheet")(function* ({ input, ctx }) {
          yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

          const db = yield* Database
          const s3 = yield* S3Service
          const contactSheetBuilder = yield* ContactSheetBuilder
          const contactSheetsBucketName = yield* Config.string("CONTACT_SHEETS_BUCKET_NAME")

          const participant = yield* db.participantsQueries.getParticipantByReference({
            reference: input.reference,
            domain: input.domain,
          })

          if (Option.isNone(participant)) {
            return yield* Effect.fail(
              new TRPCError({
                code: "NOT_FOUND",
                message: "Participant not found",
              })
            )
          }

          const submissions = participant.value.submissions || []
          if (submissions.length === 0) {
            return yield* Effect.fail(
              new TRPCError({
                code: "BAD_REQUEST",
                message: "Participant has no submissions",
              })
            )
          }

          // Validate photo count
          yield* validatePhotoCount(
            input.reference,
            input.domain,
            submissions.map((s) => s.key),
            participant.value.competitionClass
          )

          // Get sponsor
          const sponsor = yield* db.sponsorsQueries.getLatestSponsorByType({
            marathonId: participant.value.marathonId,
            type: "contact-sheets",
          })

          // Get topics
          const topics = yield* db.topicsQueries
            .getTopicsByDomain({
              domain: input.domain,
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

          // Generate contact sheet key
          const contactSheetKey = generateContactSheetKey(input.domain, input.reference)

          // Create the contact sheet
          const contactSheetBuffer = yield* contactSheetBuilder.createSheet({
            domain: input.domain,
            reference: input.reference,
            keys,
            sponsorKey: Option.isSome(sponsor) ? sponsor.value.key : undefined,
            sponsorPosition: "bottom-right",
            topics,
          })

          // Upload to S3
          yield* s3.putFile(contactSheetsBucketName, contactSheetKey, contactSheetBuffer)

          // Save to database
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
        })
      )
    ),
})

