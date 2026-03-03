import { Schema } from "effect"

export class SponsorsApiError extends Schema.TaggedError<SponsorsApiError>()(
  "@blikka/api/sponsors-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) { }

export const GetSponsorsByMarathonInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const CreateSponsorInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    type: Schema.Literal("contact-sheets", "live-initial-1", "live-initial-2", "live-success-1", "live-success-2"),
    position: Schema.Literal("bottom-right", "bottom-left", "top-right", "top-left"),
    key: Schema.String,
  })
)

export const GenerateSponsorUploadUrlInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    type: Schema.Literal("contact-sheets", "live-initial-1", "live-initial-2", "live-success-1", "live-success-2"),
    position: Schema.Literal("bottom-right", "bottom-left", "top-right", "top-left"),
  })
)

