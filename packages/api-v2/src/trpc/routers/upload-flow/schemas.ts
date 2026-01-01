import { Schema } from "effect"

export class InitializeUploadFlowError extends Schema.TaggedError<InitializeUploadFlowError>()(
  "InitializeUploadFlowError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const GetPublicMarathonSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const InitializeUploadFlowSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    competitionClassId: Schema.Number,
    deviceGroupId: Schema.Number,
  })
)
