import { Schema } from 'effect'

const TermsAcceptanceInputSchema = {
  termsAccepted: Schema.Boolean.pipe(Schema.optional),
  acceptedLocale: Schema.NullOr(Schema.String).pipe(Schema.optional),
}

export const GetPublicMarathonSchema = Schema.Struct({
  domain: Schema.String,
})

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
})

export const ResolveByCameraParticipantByPhoneSchema = Schema.Struct({
  domain: Schema.String,
  phoneNumber: Schema.String,
})

export const CheckParticipantExistsSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export const GetUploadStatusSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
  orderIndexes: Schema.Array(Schema.Number),
})

export const GetParticipantValidationStatusSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export const RefreshPresignedUploadsSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
  orderIndexes: Schema.Array(Schema.Number),
  uploadContentTypes: Schema.Array(Schema.String).pipe(Schema.optional),
})

export const ReTriggerUploadFlowSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export type GetPublicMarathon = Schema.Schema.Type<typeof GetPublicMarathonSchema>
export type PrepareUploadFlow = Schema.Schema.Type<typeof PrepareUploadFlowSchema>
export type ResolveByCameraParticipantByPhone = Schema.Schema.Type<
  typeof ResolveByCameraParticipantByPhoneSchema
>
export type CheckParticipantExists = Schema.Schema.Type<typeof CheckParticipantExistsSchema>
export type GetUploadStatus = Schema.Schema.Type<typeof GetUploadStatusSchema>
export type GetParticipantValidationStatus = Schema.Schema.Type<
  typeof GetParticipantValidationStatusSchema
>
export type RefreshPresignedUploads = Schema.Schema.Type<typeof RefreshPresignedUploadsSchema>
export type ReTriggerUploadFlow = Schema.Schema.Type<typeof ReTriggerUploadFlowSchema>
