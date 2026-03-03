import { Schema } from "effect"

export class ZipFilesApiError extends Schema.TaggedError<ZipFilesApiError>()(
  "@blikka/api/ZipFilesApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const InitializeZipDownloadsInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetZipSubmissionStatusInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetZipSubmissionStatusOutputSchema = Schema.Struct({
  totalParticipants: Schema.Number,
  withZippedSubmissions: Schema.Number,
  missingReferences: Schema.Array(Schema.String),
})

export const GetZipDownloadProgressInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    processId: Schema.String,
  })
)

export const GetZipDownloadProgressOutputSchema = Schema.Struct({
  processId: Schema.String,
  status: Schema.Union(
    Schema.Literal("initializing"),
    Schema.Literal("processing"),
    Schema.Literal("completed"),
    Schema.Literal("failed"),
    Schema.Literal("cancelled")
  ),
  totalChunks: Schema.Number,
  completedChunks: Schema.Number,
  failedChunks: Schema.Number,
  competitionClasses: Schema.Array(
    Schema.Struct({
      competitionClassId: Schema.Number,
      competitionClassName: Schema.String,
      totalChunks: Schema.Number,
    })
  ),
})

// New schemas for active process tracking and cancellation
export const GetActiveProcessInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const CancelDownloadProcessInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    processId: Schema.String,
  })
)
