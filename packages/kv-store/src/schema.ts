import { Schema } from "effect";

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
export const StringArrayFromString = Schema.transform(
  Schema.String,
  Schema.Array(Schema.String),
  {
    strict: true,
    decode: (s) => (s === "" ? [] : s.split(",")),
    encode: (arr) => arr.join(","),
  },
);

/**
 * Transform for JSON arrays stored as strings in Redis.
 * Encoded: '[]' | '[{"id":1}]'
 * Decoded: [] | [{ id: 1 }]
 */
function JsonArrayFromString<A, I, R>(itemSchema: Schema.Schema<A, I, R>) {
  return Schema.transform(Schema.String, Schema.Array(itemSchema), {
    strict: true,
    decode: (s) => {
      if (s === "" || s === "[]") return [];
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    encode: (arr) => JSON.stringify(arr),
  });
}

// ----------------------------------------------------------------------------
// Upload/Submission Schemas (used with JSON storage, not HASH)
// ----------------------------------------------------------------------------

export const SubmissionStateSchema = Schema.Struct({
  key: Schema.String,
  orderIndex: Schema.Number,
  uploaded: Schema.Boolean,
  thumbnailKey: Schema.NullOr(Schema.String),
  exifProcessed: Schema.Boolean,
});

export const makeInitialSubmissionState = (key: string, orderIndex: number) =>
  SubmissionStateSchema.make({
    key,
    uploaded: false,
    orderIndex,
    thumbnailKey: null,
    exifProcessed: false,
  });

export const ParticipantStateSchema = Schema.Struct({
  expectedCount: Schema.Number,
  orderIndexes: Schema.Array(Schema.Number),
  processedIndexes: Schema.Array(Schema.Number),
  validated: Schema.Boolean,
  zipKey: Schema.String,
  contactSheetKey: Schema.String,
  errors: Schema.Array(Schema.String),
  finalized: Schema.Boolean,
  checkedAt: Schema.NullOr(Schema.String),
});

export const makeInitialParticipantState = (
  expectedCount: number,
  orderIndexes: number[],
) =>
  ParticipantStateSchema.make({
    expectedCount,
    orderIndexes,
    processedIndexes: Array.from({ length: expectedCount }, () => 0),
    validated: false,
    zipKey: "",
    contactSheetKey: "",
    errors: [],
    finalized: false,
    checkedAt: null,
  });

export const ExifStateSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});

export const IncrementResultSchema = Schema.Literal(
  "FINALIZED",
  "PROCESSED_SUBMISSION",
  "DUPLICATE_ORDER_INDEX",
  "ALREADY_FINALIZED",
  "INVALID_ORDER_INDEX",
  "MISSING_DATA",
);

export const ZipProgressSchema = Schema.Struct({
  progress: Schema.Number,
  status: Schema.String,
  errors: Schema.Array(Schema.String),
  zipKey: Schema.String,
});

export const makeInitialZipProgress = (zipKey: string) =>
  ZipProgressSchema.make({
    progress: 0,
    status: "pending",
    errors: [],
    zipKey,
  });

// ----------------------------------------------------------------------------
// Download State Schemas (stored as Redis HASH - all values are strings)
// ----------------------------------------------------------------------------

export const DownloadProcessStatusSchema = Schema.Literal(
  "initializing",
  "processing",
  "completed",
  "failed",
  "cancelled",
);

/**
 * Competition class info stored in the download process.
 * This is used as nested data within JSON arrays.
 */
const CompetitionClassSchema = Schema.Struct({
  competitionClassId: Schema.Number,
  competitionClassName: Schema.String,
  totalChunks: Schema.Number,
});

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
});

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
});

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

export type SubmissionState = typeof SubmissionStateSchema.Type;
export type ParticipantState = typeof ParticipantStateSchema.Type;
export type ExifState = typeof ExifStateSchema.Type;
export type ChunkState = typeof ChunkStateSchema.Type;
export type DownloadProcessStatus = typeof DownloadProcessStatusSchema.Type;
export type DownloadProcessState = typeof DownloadProcessStateSchema.Type;

// Also export the encoded types for clarity
// export type ChunkStateEncoded = typeof ChunkStateRedisSchema.Encoded
// export type DownloadProcessStateEncoded = typeof DownloadProcessStateRedisSchema.Encoded
