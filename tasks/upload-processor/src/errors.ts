import { Schema } from "effect"

export class JsonParseError extends Schema.TaggedError<JsonParseError>()("JsonParseError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}
export class InvalidKeyFormatError extends Schema.TaggedError<InvalidKeyFormatError>()(
  "InvalidKeyFormatError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class PhotoNotFoundError extends Schema.TaggedError<PhotoNotFoundError>()(
  "PhotoNotFoundError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    details: Schema.optional(Schema.String),
  }
) {}

export class InvalidS3EventError extends Schema.TaggedError<InvalidS3EventError>()(
  "InvalidS3EventError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class FailedToIncrementParticipantStateError extends Schema.TaggedError<FailedToIncrementParticipantStateError>()(
  "FailedToIncrementParticipantStateError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class FailedToFinalizeParticipantError extends Schema.TaggedError<FailedToFinalizeParticipantError>()(
  "FailedToFinalizeParticipantError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    domain: Schema.String,
    reference: Schema.String,
  }
) {}
