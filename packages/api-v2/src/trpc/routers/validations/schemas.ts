import { Schema } from "effect"

export class ValidationsApiError extends Schema.TaggedError<ValidationsApiError>()(
  "ValidationsApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const RunValidationsSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  })
)

export const CreateParticipantVerificationSchema = Schema.standardSchemaV1(
  Schema.Struct({
    data: Schema.Struct({
      participantId: Schema.Number,
      staffId: Schema.String,
      notes: Schema.optional(Schema.String),
    }),
  })
)

export const UpdateValidationResultSchema = Schema.standardSchemaV1(
  Schema.Struct({
    id: Schema.Number,
    data: Schema.Struct({
      overruled: Schema.Boolean,
    }),
  })
)

export const GetParticipantVerificationByReferenceSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  })
)
