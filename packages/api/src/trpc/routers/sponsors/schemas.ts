import { Schema } from "effect"

export class SponsorsApiError extends Schema.TaggedErrorClass<SponsorsApiError>()(
  "@blikka/api/sponsors-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export const GetSponsorsByMarathonInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const CreateSponsorInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    type: Schema.Literals(["contact-sheets", "live-initial-1", "live-initial-2", "live-success-1", "live-success-2"]),
    position: Schema.Literals(["bottom-right", "bottom-left", "top-right", "top-left"]),
    key: Schema.String,
  })
)

export const GenerateSponsorUploadUrlInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    type: Schema.Literals(["contact-sheets", "live-initial-1", "live-initial-2", "live-success-1", "live-success-2"]),
    position: Schema.Literals(["bottom-right", "bottom-left", "top-right", "top-left"]),
  })
)

