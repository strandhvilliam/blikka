import { Schema } from "effect"

export class ExportsApiError extends Schema.TaggedErrorClass<ExportsApiError>()(
  "@blikka/api/ExportsApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}
