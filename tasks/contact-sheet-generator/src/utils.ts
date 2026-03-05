import { Effect, Schema } from "effect"
import { ParticipantState } from "@blikka/kv-store"
import { CompetitionClass } from "@blikka/db"

const VALID_PHOTO_COUNTS = [8, 24]

export class InvalidSheetGenerationData extends Schema.TaggedErrorClass<InvalidSheetGenerationData>()(
  "InvalidSheetGenerationData",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export const generateContactSheetKey = (domain: string, reference: string) =>
  `${domain}/${reference}/contact_sheet_${reference}_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.jpg`

export const ensureReadyForSheetGeneration = Effect.fn(
  "contactSheetGenerator.ensureReadyForSheetGeneration"
)(function* (kvData: ParticipantState, reference: string, domain: string) {
  if (!kvData.finalized) {
    yield* Effect.logInfo("Participant state not finalized, skipping")
    return yield* Effect.succeed({ shouldSkip: true })
  }

  if (kvData.contactSheetKey) {
    yield* Effect.logInfo("Contact sheet already generated, skipping")
    return yield* Effect.succeed({ shouldSkip: true })
  }

  if (kvData.expectedCount === 1) {
    yield* Effect.logInfo("Participant has only one photo, skipping")
  }

  return yield* Effect.succeed({ shouldSkip: false })
})

export const validatePhotoCount = Effect.fn("contactSheetGenerator.validatePhotoCount")(function* (
  reference: string,
  domain: string,
  keys: string[],
  competitionClass: CompetitionClass | null
) {
  if (!competitionClass?.numberOfPhotos) {
    return yield* Effect.fail(
      new InvalidSheetGenerationData({
        message: "Missing competition class photo count",
      })
    )
  }

  const expectedCount = competitionClass.numberOfPhotos
  if (!VALID_PHOTO_COUNTS.includes(expectedCount)) {
    return yield* Effect.fail(
      new InvalidSheetGenerationData({
        message: `Unsupported photo count ${expectedCount} for participant ${reference}`,
      })
    )
  }

  if (keys.length !== expectedCount) {
    return yield* Effect.fail(
      new InvalidSheetGenerationData({
        message: `Photo count mismatch. Expected ${expectedCount}, got ${keys.length}`,
      })
    )
  }
})
