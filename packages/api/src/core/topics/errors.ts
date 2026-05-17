import { Schema } from "effect"

export class TopicApiError extends Schema.TaggedErrorClass<TopicApiError>()(
  "@blikka/api/topic-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}
