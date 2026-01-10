import { Schema } from "effect"

export class ZipFilesApiError extends Schema.TaggedError<ZipFilesApiError>()(
  "@blikka/api-v2/ZipFilesApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const InitializeZipDownloadsInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)
