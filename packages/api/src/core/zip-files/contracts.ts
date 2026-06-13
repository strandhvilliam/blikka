import { Schema } from 'effect'

export const GenerateParticipantZipInputSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export type GenerateParticipantZipInput = Schema.Schema.Type<
  typeof GenerateParticipantZipInputSchema
>

export const GetParticipantZipDownloadUrlInputSchema = GenerateParticipantZipInputSchema

export type GetParticipantZipDownloadUrlInput = Schema.Schema.Type<
  typeof GetParticipantZipDownloadUrlInputSchema
>

export const GetParticipantZipDownloadUrlOutputSchema = Schema.Struct({
  downloadUrl: Schema.String,
  filename: Schema.String,
})

export type GetParticipantZipDownloadUrlOutput = Schema.Schema.Type<
  typeof GetParticipantZipDownloadUrlOutputSchema
>

export const InitializeZipDownloadsInputSchema = Schema.Struct({
  domain: Schema.String,
})

export const GetZipSubmissionStatusInputSchema = Schema.Struct({
  domain: Schema.String,
})

export const GetZipSubmissionStatusOutputSchema = Schema.Struct({
  totalParticipants: Schema.Number,
  withZippedSubmissions: Schema.Number,
  missingReferences: Schema.Array(Schema.String),
})

export const ZipDownloadsByProcessIdInputSchema = Schema.Struct({
  domain: Schema.String,
  processId: Schema.String,
})

// Active process tracking and cancellation
export const GetActiveProcessInputSchema = Schema.Struct({
  domain: Schema.String,
})

export const CancelDownloadProcessInputSchema = Schema.Struct({
  domain: Schema.String,
  processId: Schema.String,
})

export const RetryExportChunkInputSchema = Schema.Struct({
  domain: Schema.String,
  processId: Schema.String,
  jobId: Schema.String,
})

export type InitializeZipDownloadsInput = Schema.Schema.Type<
  typeof InitializeZipDownloadsInputSchema
>
export type GetZipSubmissionStatusInput = Schema.Schema.Type<
  typeof GetZipSubmissionStatusInputSchema
>
export type GetZipSubmissionStatusOutput = Schema.Schema.Type<
  typeof GetZipSubmissionStatusOutputSchema
>
export type ZipDownloadsByProcessIdInput = Schema.Schema.Type<typeof ZipDownloadsByProcessIdInputSchema>
export type GetActiveProcessInput = Schema.Schema.Type<typeof GetActiveProcessInputSchema>
export type CancelDownloadProcessInput = Schema.Schema.Type<typeof CancelDownloadProcessInputSchema>
export type RetryExportChunkInput = Schema.Schema.Type<typeof RetryExportChunkInputSchema>
