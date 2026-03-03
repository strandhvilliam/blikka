import { Schema } from "effect"

export class MarathonApiError extends Schema.TaggedError<MarathonApiError>()(
  "@blikka/api/marathon-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) { }

export const GetByDomainInputSchema = Schema.standardSchemaV1(
  Schema.Struct({ domain: Schema.String })
)

export const UpdateMarathonInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.optional(Schema.String),
      description: Schema.optional(Schema.String),
      startDate: Schema.optional(Schema.String),
      endDate: Schema.optional(Schema.String),
      logoUrl: Schema.optional(Schema.String),
      languages: Schema.optional(Schema.String),
      termsAndConditionsKey: Schema.optional(Schema.String),
    }),
  })
)

export const ResetMarathonInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetLogoUploadUrlInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    currentKey: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  })
)

export const GetTermsUploadUrlInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)


export const GetCurrentTermsInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)