import { Schema } from "effect"

export class MarathonApiError extends Schema.TaggedErrorClass<MarathonApiError>()(
  "@blikka/api/marathon-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) { }
