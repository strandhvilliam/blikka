import { Schema } from "effect"

export class SponsorsApiError extends Schema.TaggedErrorClass<SponsorsApiError>()(
  "@blikka/api/sponsors-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}
