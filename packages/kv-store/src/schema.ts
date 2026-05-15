import { Schema, SchemaTransformation } from "effect"
import { ParticipantState, ParticipantStateSchema } from "./upload-session-repository"

// ============================================================================
// Redis Hash Encoding Strategy
// ============================================================================
// Redis HASH stores all values as strings. We use Effect Schema transforms
// to handle the conversion between our application types and Redis strings.
//
// Pattern:
// - "Encoded" (From) = what Redis stores (all strings)
// - "Type" (To) = what our application uses (numbers, arrays, etc.)
// - Schema.decode: Encoded (Redis strings) → Type (app values)
// - Schema.encode: Type (app values) → Encoded (Redis strings)
// ============================================================================

// ----------------------------------------------------------------------------
// Primitive Redis Transformations
// ----------------------------------------------------------------------------

/**
 * Transform for string arrays stored as comma-separated strings in Redis.
 * Encoded: "a,b,c" | ""
 * Decoded: ["a", "b", "c"] | []
 */
export const StringArrayFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Array(Schema.String),
    SchemaTransformation.transform({
      decode: (s) => (s === "" ? ([] as readonly string[]) : (s.split(",") as readonly string[])),
      encode: (arr) => arr.join(","),
    }),
  ),
)

// ----------------------------------------------------------------------------
// Upload/Submission Schemas (used with JSON storage, not HASH)
// ----------------------------------------------------------------------------

export interface CurrentUploadSessionGuard {
  readonly matched: boolean
  readonly reason?: "missing-event-upload-session-id" | "stale-upload-session"
}

export const isCurrentUploadSession = ({
  eventUploadSessionId,
  participantState,
}: {
  readonly eventUploadSessionId?: string
  readonly participantState: ParticipantState
}): CurrentUploadSessionGuard => {
  if (!eventUploadSessionId) {
    return {
      matched: false,
      reason: "missing-event-upload-session-id",
    }
  }

  if (participantState.uploadSessionId !== eventUploadSessionId) {
    return {
      matched: false,
      reason: "stale-upload-session",
    }
  }

  return { matched: true }
}

export const ExifStateSchema = Schema.Record(Schema.String, Schema.Unknown)

// ----------------------------------------------------------------------------
// Download State Schemas (stored as Redis HASH - all values are strings)
// ----------------------------------------------------------------------------

export const DownloadProcessStatusSchema = Schema.Literals([
  "initializing",
  "processing",
  "completed",
  "failed",
  "cancelled",
])

/**
 * Competition class info stored in the download process.
 * This is used as nested data within JSON arrays.
 */
const CompetitionClassSchema = Schema.Struct({
  competitionClassId: Schema.Number,
  competitionClassName: Schema.String,
  totalChunks: Schema.Number,
})

// ----------------------------------------------------------------------------
// ChunkState - Stored in Redis HASH
// ----------------------------------------------------------------------------

/**
 * ChunkState as used in the application.
 */
export const ChunkStateSchema = Schema.Struct({
  processId: Schema.String,
  domain: Schema.String,
  competitionClassId: Schema.Number,
  competitionClassName: Schema.String,
  minReference: Schema.Number,
  maxReference: Schema.Number,
  zipKey: Schema.String,
  chunkIndex: Schema.Number,
  totalChunks: Schema.Number,
})

/**
 * ChunkState as stored in Redis HASH (all string values).
 * Encoded type = Record<string, string> for Redis
 * Decoded type = ChunkState for application
 */
// export const ChunkStateRedisSchema = Schema.Struct({
//   processId: Schema.String,
//   domain: Schema.String,
//   competitionClassId: Schema.NumberFromString,
//   competitionClassName: Schema.String,
//   minReference: Schema.String,
//   maxReference: Schema.String,
//   zipKey: Schema.String,
//   chunkIndex: Schema.NumberFromString,
//   totalChunks: Schema.Number,
// })

// ----------------------------------------------------------------------------
// DownloadProcessState - Stored in Redis HASH
// ----------------------------------------------------------------------------

/**
 * DownloadProcessState as used in the application.
 */
export const DownloadProcessStateSchema = Schema.Struct({
  processId: Schema.String,
  domain: Schema.String,
  createdAt: Schema.String,
  lastUpdatedAt: Schema.String,
  status: DownloadProcessStatusSchema,
  totalChunks: Schema.Number,
  completedChunks: Schema.Number,
  failedChunks: Schema.Number,
  jobIds: Schema.Array(Schema.String),
  failedJobIds: Schema.Array(Schema.String),
  competitionClasses: Schema.Array(CompetitionClassSchema),
})

/**
 * DownloadProcessState as stored in Redis HASH (all string values).
 * Encoded type = Record<string, string> for Redis
 * Decoded type = DownloadProcessState for application
 */
// export const DownloadProcessStateRedisSchema = Schema.Struct({
//   processId: Schema.String,
//   domain: Schema.String,
//   createdAt: Schema.String,
//   lastUpdatedAt: Schema.String,
//   status: DownloadProcessStatusSchema,
//   totalChunks: Schema.Number,
//   completedChunks: Schema.Number,
//   failedChunks: Schema.Number,
//   jobIds: StringArrayFromString,
//   failedJobIds: StringArrayFromString,
//   competitionClasses: JsonArrayFromString(CompetitionClassSchema),
// })

// ----------------------------------------------------------------------------
// Type Exports
// ----------------------------------------------------------------------------

export type ExifState = typeof ExifStateSchema.Type
export type ChunkState = typeof ChunkStateSchema.Type
export type DownloadProcessStatus = typeof DownloadProcessStatusSchema.Type
export type DownloadProcessState = typeof DownloadProcessStateSchema.Type

// Also export the encoded types for clarity
// export type ChunkStateEncoded = typeof ChunkStateRedisSchema.Encoded
// export type DownloadProcessStateEncoded = typeof DownloadProcessStateRedisSchema.Encoded
