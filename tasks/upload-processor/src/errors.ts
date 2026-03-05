import { Schema } from "effect"

export class JsonParseError extends Schema.TaggedErrorClass<JsonParseError>()("JsonParseError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}
export class InvalidKeyFormatError extends Schema.TaggedErrorClass<InvalidKeyFormatError>()(
  "InvalidKeyFormatError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export class PhotoNotFoundError extends Schema.TaggedErrorClass<PhotoNotFoundError>()(
  "PhotoNotFoundError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    details: Schema.optional(Schema.String),
  },
) {
}

export class InvalidS3EventError extends Schema.TaggedErrorClass<InvalidS3EventError>()(
  "InvalidS3EventError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export class InvalidMessageError extends Schema.TaggedErrorClass<InvalidMessageError>()(
  "InvalidMessageError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    bodyPreview: Schema.optional(Schema.String),
  },
) {
}

export class FailedToIncrementParticipantStateError extends Schema.TaggedErrorClass<FailedToIncrementParticipantStateError>()(
  "FailedToIncrementParticipantStateError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export class FailedToFinalizeParticipantError extends Schema.TaggedErrorClass<FailedToFinalizeParticipantError>()(
  "FailedToFinalizeParticipantError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    domain: Schema.String,
    reference: Schema.String,
  },
) {
}
