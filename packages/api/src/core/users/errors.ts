import { Schema } from "effect"

export class UsersApiError extends Schema.TaggedErrorClass<UsersApiError>()(
  "@blikka/api/users-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}
