import { Schema } from "effect"

export class ZipFilesApiError extends Schema.TaggedErrorClass<ZipFilesApiError>()(
  "@blikka/api/ZipFilesApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}
