import { Schema } from 'effect'

const UploadExifSchema = Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))

const TermsAcceptanceInputSchema = {
  termsAccepted: Schema.Boolean.pipe(Schema.optional),
  acceptedLocale: Schema.NullOr(Schema.String).pipe(Schema.optional),
}

const TermsAcceptanceSourceSchema = Schema.Literals(['participant', 'staff-on-behalf'])

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
})

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
})

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
  replaceCompletedParticipantUpload: Schema.Boolean.pipe(Schema.optional),
  ...TermsAcceptanceInputSchema,
})

export type InitializeUploadFlow = Schema.Schema.Type<typeof InitializeUploadFlowSchema>
export type InitializeByCameraUpload = Schema.Schema.Type<typeof InitializeByCameraUploadSchema>
export type InitializeStaffByCameraUpload = Schema.Schema.Type<
  typeof InitializeStaffByCameraUploadSchema
>

export type InitializeByCameraUploadInput =
  | (InitializeByCameraUpload & { readonly variant: 'device' })
  | (InitializeStaffByCameraUpload & { readonly variant: 'staff' })
