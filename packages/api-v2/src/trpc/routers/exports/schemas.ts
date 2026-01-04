import { Schema } from "effect"

export class ExportsApiError extends Schema.TaggedError<ExportsApiError>()(
  "@blikka/api-v2/ExportsApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const GetParticipantsExportDataInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetSubmissionsExportDataInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetExifExportDataInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetValidationResultsExportDataInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    onlyFailed: Schema.optional(Schema.Boolean),
  })
)
