import { Schema } from "effect";

export class ExportDataNotFoundError extends Schema.TaggedErrorClass<ExportDataNotFoundError>()(
  "ExportDataNotFoundError",
  {
    message: Schema.String,
    domain: Schema.String,
    reference: Schema.String,
    key: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class FailedToGenerateZipError extends Schema.TaggedErrorClass<FailedToGenerateZipError>()(
  "FailedToGenerateZipError",
  {
    message: Schema.String,
    domain: Schema.String,
    reference: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}
