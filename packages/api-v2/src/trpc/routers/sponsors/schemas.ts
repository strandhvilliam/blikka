import { Schema } from "effect"

export class SponsorsApiError extends Schema.TaggedError<SponsorsApiError>()(
  "@blikka/api-v2/sponsors-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const GetSponsorsByMarathonInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const CreateSponsorInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    type: Schema.Literal("contact-sheets", "participant-initial", "participant-success"),
    position: Schema.Literal("bottom-right", "bottom-left", "top-right", "top-left"),
    key: Schema.String,
  })
)

export const GenerateSponsorUploadUrlInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    type: Schema.Literal("contact-sheets", "participant-initial", "participant-success"),
    position: Schema.Literal("bottom-right", "bottom-left", "top-right", "top-left"),
  })
)

