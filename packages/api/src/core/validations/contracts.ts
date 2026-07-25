import { Schema } from 'effect'

export const RunValidationsSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export const CreateParticipantVerificationSchema = Schema.Struct({
  domain: Schema.String,
  data: Schema.Struct({
    participantId: Schema.Number,
    notes: Schema.optional(Schema.String),
    /**
     * Overrule every blocking (failed + error, not already overruled) validation on the
     * participant as part of the same call, instead of the client issuing one overrule
     * mutation per finding and then verifying.
     */
    overruleBlockingValidations: Schema.optional(Schema.Boolean),
  }),
})

export const UpdateValidationResultSchema = Schema.Struct({
  domain: Schema.String,
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

/**
 * Service-side payload. `staffId` comes from the session and `domain` from the verified
 * request domain — neither is taken from the wire, so a caller cannot attribute a
 * verification to another user or reach a participant in another marathon.
 */
export type CreateParticipantVerificationServiceInput = CreateParticipantVerification['data'] & {
  staffId: string
  domain: string
}
