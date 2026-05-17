import { Schema } from "effect"

export class CompetitionClassApiError extends Schema.TaggedErrorClass<CompetitionClassApiError>()(
  "@blikka/api/competition-class-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}
