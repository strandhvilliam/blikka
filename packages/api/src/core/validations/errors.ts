import { Schema } from "effect"

export class ValidationsApiError extends Schema.TaggedErrorClass<ValidationsApiError>()(
  "ValidationsApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}
