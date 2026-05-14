import type { EventBusError } from "@blikka/aws"
import type { ExifKVRepositoryError, UploadSessionRepositoryError } from "@blikka/kv-store"
import { Schema } from "effect"

export class PhotoNotFoundError extends Schema.TaggedErrorClass<PhotoNotFoundError>()(
  "PhotoNotFoundError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    key: Schema.String,
  },
) {}

export type SubmissionProcessorError =
  | PhotoNotFoundError
  | EventBusError
  | UploadSessionRepositoryError
  | ExifKVRepositoryError
