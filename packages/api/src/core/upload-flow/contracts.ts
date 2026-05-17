import { Schema } from "effect"

const UploadExifSchema = Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))

const TermsAcceptanceInputSchema = {
  termsAccepted: Schema.Boolean.pipe(Schema.optional),
  acceptedLocale: Schema.NullOr(Schema.String).pipe(Schema.optional),
}

const TermsAcceptanceSourceSchema = Schema.Literals(["participant", "staff-on-behalf"])

const ALLOWED_MARATHON_UPLOAD_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
])

/** Normalizes client-provided MIME types for S3 presigned PUT signatures. */
export function normalizeUploadContentType(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim().toLowerCase()
  if (trimmed === "" || trimmed === "image/jpg") {
    return "image/jpeg"
  }
  if (ALLOWED_MARATHON_UPLOAD_CONTENT_TYPES.has(trimmed)) {
    return trimmed
  }
  return "image/jpeg"
}

export const GetPublicMarathonSchema = Schema.Struct({
    domain: Schema.String,
  });

export const InitializeUploadFlowSchema = Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    competitionClassId: Schema.Number,
    deviceGroupId: Schema.Number,
    phoneNumber: Schema.NullOr(Schema.String).pipe(Schema.optional),
    uploadContentTypes: Schema.Array(Schema.String).pipe(Schema.optional),
    uploadExif: Schema.Array(UploadExifSchema).pipe(Schema.optional),
    ...TermsAcceptanceInputSchema,
    termsAcceptanceSource: TermsAcceptanceSourceSchema.pipe(Schema.optional),
  });

export const PrepareUploadFlowSchema = Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    competitionClassId: Schema.Number,
    deviceGroupId: Schema.Number,
    phoneNumber: Schema.NullOr(Schema.String).pipe(Schema.optional),
    ...TermsAcceptanceInputSchema,
  });

export const InitializeByCameraUploadSchema = Schema.Struct({
    domain: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    deviceGroupId: Schema.Number,
    phoneNumber: Schema.String,
    uploadContentTypes: Schema.Array(Schema.String).pipe(Schema.optional),
    uploadExif: Schema.Array(UploadExifSchema).pipe(Schema.optional),
    replaceExistingActiveTopicUpload: Schema.Boolean.pipe(Schema.optional),
    ...TermsAcceptanceInputSchema,
  });

/** Staff laptop flow: participant identity is the entered reference, not phone lookup. */
export const InitializeStaffByCameraUploadSchema = Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    deviceGroupId: Schema.Number,
    phoneNumber: Schema.String,
    uploadContentTypes: Schema.Array(Schema.String).pipe(Schema.optional),
    uploadExif: Schema.Array(UploadExifSchema).pipe(Schema.optional),
    replaceExistingActiveTopicUpload: Schema.Boolean.pipe(Schema.optional),
    /** Staff laptop: allow new upload after participant status completed or verified. */
    replaceFinalizedParticipantUpload: Schema.Boolean.pipe(Schema.optional),
    ...TermsAcceptanceInputSchema,
  });

export const ResolveByCameraParticipantByPhoneSchema = Schema.Struct({
    domain: Schema.String,
    phoneNumber: Schema.String,
  });

export const CheckParticipantExistsSchema = Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  });

export const GetUploadStatusSchema = Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    orderIndexes: Schema.Array(Schema.Number),
  });

export const RefreshPresignedUploadsSchema = Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    orderIndexes: Schema.Array(Schema.Number),
    uploadContentTypes: Schema.Array(Schema.String).pipe(Schema.optional),
  });

export const ReTriggerUploadFlowSchema = Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  });

export type GetPublicMarathon = Schema.Schema.Type<typeof GetPublicMarathonSchema>
export type InitializeUploadFlow = Schema.Schema.Type<typeof InitializeUploadFlowSchema>
export type PrepareUploadFlow = Schema.Schema.Type<typeof PrepareUploadFlowSchema>
export type InitializeByCameraUpload = Schema.Schema.Type<typeof InitializeByCameraUploadSchema>
export type InitializeStaffByCameraUpload = Schema.Schema.Type<typeof InitializeStaffByCameraUploadSchema>
export type ResolveByCameraParticipantByPhone = Schema.Schema.Type<typeof ResolveByCameraParticipantByPhoneSchema>
export type CheckParticipantExists = Schema.Schema.Type<typeof CheckParticipantExistsSchema>
export type GetUploadStatus = Schema.Schema.Type<typeof GetUploadStatusSchema>
export type RefreshPresignedUploads = Schema.Schema.Type<typeof RefreshPresignedUploadsSchema>
export type ReTriggerUploadFlow = Schema.Schema.Type<typeof ReTriggerUploadFlowSchema>
