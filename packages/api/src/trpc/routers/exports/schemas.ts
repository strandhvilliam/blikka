import { Schema } from "effect"

export class ExportsApiError extends Schema.TaggedErrorClass<ExportsApiError>()(
  "@blikka/api/ExportsApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const GetParticipantsExportDataInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetSubmissionsExportDataInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetExifExportDataInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetValidationResultsExportDataInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    onlyFailed: Schema.optional(Schema.Boolean),
  })
)
