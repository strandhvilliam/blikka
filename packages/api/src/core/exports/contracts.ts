import { Schema } from "effect"

export const GetParticipantsExportDataInputSchema = Schema.Struct({
    domain: Schema.String,
  });

export const GetSubmissionsExportDataInputSchema = Schema.Struct({
    domain: Schema.String,
  });

export const GetExifExportDataInputSchema = Schema.Struct({
    domain: Schema.String,
  });

export const GetValidationResultsExportDataInputSchema = Schema.Struct({
    domain: Schema.String,
    onlyFailed: Schema.optional(Schema.Boolean),
  });

export type GetParticipantsExportDataInput = Schema.Schema.Type<typeof GetParticipantsExportDataInputSchema>
export type GetSubmissionsExportDataInput = Schema.Schema.Type<typeof GetSubmissionsExportDataInputSchema>
export type GetExifExportDataInput = Schema.Schema.Type<typeof GetExifExportDataInputSchema>
export type GetValidationResultsExportDataInput = Schema.Schema.Type<typeof GetValidationResultsExportDataInputSchema>

/** Shared `{ domain }` shape for exports that scope only by marathon domain. */
export type DomainScopedExportInput = GetParticipantsExportDataInput
