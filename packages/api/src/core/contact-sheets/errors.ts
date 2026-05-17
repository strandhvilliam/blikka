import { Schema } from "effect"

export class ContactSheetApiError extends Schema.TaggedErrorClass<ContactSheetApiError>()(
  "ContactSheetApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}
