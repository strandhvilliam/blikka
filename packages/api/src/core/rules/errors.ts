import { Schema } from "effect"

export class RulesApiError extends Schema.TaggedErrorClass<RulesApiError>()(
  "@blikka/api/RulesApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}
