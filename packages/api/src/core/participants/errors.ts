import { Schema } from "effect"

export class ParticipantApiError extends Schema.TaggedErrorClass<ParticipantApiError>()(
  "@blikka/api/ParticipantApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}
