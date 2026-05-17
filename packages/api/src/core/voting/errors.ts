import { Schema } from "effect"

export class VotingApiError extends Schema.TaggedErrorClass<VotingApiError>()(
  "@blikka/api/VotingApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}
