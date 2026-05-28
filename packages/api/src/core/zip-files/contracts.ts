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

export const GetZipDownloadProgressInputSchema = Schema.Struct({
  domain: Schema.String,
  processId: Schema.String,
})

export const GetZipDownloadProgressOutputSchema = Schema.Struct({
  processId: Schema.String,
  status: Schema.Union([
    Schema.Literal('initializing'),
    Schema.Literal('processing'),
    Schema.Literal('completed'),
    Schema.Literal('failed'),
    Schema.Literal('cancelled'),
  ]),
  totalChunks: Schema.Number,
  completedChunks: Schema.Number,
  failedChunks: Schema.Number,
  competitionClasses: Schema.Array(
    Schema.Struct({
      competitionClassId: Schema.Number,
      competitionClassName: Schema.String,
      totalChunks: Schema.Number,
    }),
  ),
})

// New schemas for active process tracking and cancellation
export const GetActiveProcessInputSchema = Schema.Struct({
  domain: Schema.String,
})

export const CancelDownloadProcessInputSchema = Schema.Struct({
  domain: Schema.String,
  processId: Schema.String,
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
export type GetZipDownloadProgressInput = Schema.Schema.Type<
  typeof GetZipDownloadProgressInputSchema
>
export type GetZipDownloadProgressOutput = Schema.Schema.Type<
  typeof GetZipDownloadProgressOutputSchema
>
export type GetActiveProcessInput = Schema.Schema.Type<typeof GetActiveProcessInputSchema>
export type CancelDownloadProcessInput = Schema.Schema.Type<typeof CancelDownloadProcessInputSchema>

/** Narrowing of {@link GetZipDownloadProgressInput} after domain-scoped middleware; service lookups use `processId` only. */
export type ZipDownloadsByProcessIdInput = Pick<GetZipDownloadProgressInput, 'processId'>
