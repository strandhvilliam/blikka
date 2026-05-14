import type { EventBusError } from "@blikka/aws"
import type { DbError } from "@blikka/db"
import type { ExifKVRepositoryError, UploadSessionRepositoryError } from "@blikka/kv-store"
import type { ValidationEngineError } from "@blikka/validation"
import { Schema } from "effect"

/// SubmissionProcessor errors
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

/// ValidationRunner errors
export class ValidationRunnerInvalidDataError extends Schema.TaggedErrorClass<ValidationRunnerInvalidDataError>()(
  "ValidationRunnerInvalidDataError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class InvalidValidationRuleError extends Schema.TaggedErrorClass<InvalidValidationRuleError>()(
  "InvalidValidationRuleError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type ValidationRunnerError =
  | ValidationRunnerInvalidDataError
  | InvalidValidationRuleError
  | UploadSessionRepositoryError
  | ExifKVRepositoryError
  | DbError
  | ValidationEngineError

/// UploadFinalizer errors

export class FailedToFinalizeParticipantError extends Schema.TaggedErrorClass<FailedToFinalizeParticipantError>()(
  "FailedToFinalizeParticipantError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type UploadFinalizerError =
  | FailedToFinalizeParticipantError
  | UploadSessionRepositoryError
  | ExifKVRepositoryError
  | DbError
