import { Schema } from "effect"

export class ContactSheetApiError extends Schema.TaggedErrorClass<ContactSheetApiError>()(
  "ContactSheetApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const GenerateContactSheetSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  })
)
