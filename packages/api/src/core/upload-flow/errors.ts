import { Schema } from "effect"

export class UploadFlowApiError extends Schema.TaggedErrorClass<UploadFlowApiError>()(
  "@blikka/api/UploadFlowApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}
