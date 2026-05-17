import { Schema } from 'effect'

export const RunValidationsSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export const CreateParticipantVerificationSchema = Schema.Struct({
  data: Schema.Struct({
    participantId: Schema.Number,
    staffId: Schema.String,
    notes: Schema.optional(Schema.String),
  }),
})

export const UpdateValidationResultSchema = Schema.Struct({
  id: Schema.Number,
  data: Schema.Struct({
    overruled: Schema.Boolean,
  }),
})

export const GetParticipantVerificationByReferenceSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export type RunValidations = Schema.Schema.Type<typeof RunValidationsSchema>
export type CreateParticipantVerification = Schema.Schema.Type<
  typeof CreateParticipantVerificationSchema
>
export type UpdateValidationResult = Schema.Schema.Type<typeof UpdateValidationResultSchema>
export type GetParticipantVerificationByReference = Schema.Schema.Type<
  typeof GetParticipantVerificationByReferenceSchema
>

/** Router merges `staffId` from the session onto wire `CreateParticipantVerification` payload. */
export type CreateParticipantVerificationServiceInput = Omit<
  CreateParticipantVerification['data'],
  'staffId'
> & { staffId: string }
