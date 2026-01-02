import { Schema } from "effect"

export class MarathonApiError extends Schema.TaggedError<MarathonApiError>()(
  "@blikka/api-v2/marathon-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const GetByDomainInputSchema = Schema.standardSchemaV1(
  Schema.Struct({ domain: Schema.String })
)
