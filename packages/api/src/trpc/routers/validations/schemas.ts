import { Schema } from "effect"

export class ValidationsApiError extends Schema.TaggedErrorClass<ValidationsApiError>()(
  "ValidationsApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const RunValidationsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  })
)

export const CreateParticipantVerificationSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    data: Schema.Struct({
      participantId: Schema.Number,
      staffId: Schema.String,
      notes: Schema.optional(Schema.String),
    }),
  })
)

export const UpdateValidationResultSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    id: Schema.Number,
    data: Schema.Struct({
      overruled: Schema.Boolean,
    }),
  })
)

export const GetParticipantVerificationByReferenceSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  })
)
