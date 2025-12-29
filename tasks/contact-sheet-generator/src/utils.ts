import { Effect, Schema } from "effect"
import { ParticipantState } from "@blikka/kv-store"
import { CompetitionClass } from "@blikka/db"

const VALID_PHOTO_COUNTS = [8, 24]

export class InvalidSheetGenerationData extends Schema.TaggedError<InvalidSheetGenerationData>()(
  "InvalidSheetGenerationData",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const generateContactSheetKey = (domain: string, reference: string) =>
  `${domain}/${reference}/contact_sheet_${reference}_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.jpg`

export const ensureReadyForSheetGeneration = Effect.fnUntraced(function* (
  kvData: ParticipantState,
  reference: string,
  domain: string
) {
  if (!kvData.finalized) {
    yield* Effect.log(
      `Participant state not finalized for reference ${reference} and domain ${domain}`
    )
    return yield* Effect.succeed({ shouldSkip: true })
  }

  if (kvData.contactSheetKey) {
    yield* Effect.log(
      `Contact sheet already generated for reference ${reference} and domain ${domain}`
    )
    return yield* Effect.succeed({ shouldSkip: true })
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
