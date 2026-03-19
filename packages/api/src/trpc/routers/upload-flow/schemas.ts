import { Schema } from "effect";

const ALLOWED_MARATHON_UPLOAD_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

/** Normalizes client-provided MIME types for S3 presigned PUT signatures. */
export function normalizeUploadContentType(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (trimmed === "" || trimmed === "image/jpg") {
    return "image/jpeg";
  }
  if (ALLOWED_MARATHON_UPLOAD_CONTENT_TYPES.has(trimmed)) {
    return trimmed;
  }
  return "image/jpeg";
}

export class UploadFlowApiError extends Schema.TaggedErrorClass<UploadFlowApiError>()(
  "@blikka/api/UploadFlowApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const GetPublicMarathonSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  }),
);

export const InitializeUploadFlowSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    competitionClassId: Schema.Number,
    deviceGroupId: Schema.Number,
    phoneNumber: Schema.NullOr(Schema.String).pipe(Schema.optional),
    uploadContentTypes: Schema.Array(Schema.String).pipe(Schema.optional),
  }),
);

export const PrepareUploadFlowSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    competitionClassId: Schema.Number,
    deviceGroupId: Schema.Number,
    phoneNumber: Schema.NullOr(Schema.String).pipe(Schema.optional),
  }),
);

export const InitializeByCameraUploadSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    deviceGroupId: Schema.Number,
    phoneNumber: Schema.String,
    replaceExistingActiveTopicUpload: Schema.Boolean.pipe(Schema.optional),
  }),
);

export const ResolveByCameraParticipantByPhoneSchema =
  Schema.toStandardSchemaV1(
    Schema.Struct({
      domain: Schema.String,
      phoneNumber: Schema.String,
    }),
  );

export const CheckParticipantExistsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  }),
);

export const GetUploadStatusSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    orderIndexes: Schema.Array(Schema.Number),
  }),
);

export const ReTriggerUploadFlowSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  }),
);
