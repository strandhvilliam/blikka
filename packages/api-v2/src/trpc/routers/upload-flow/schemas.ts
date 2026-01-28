import { Schema } from "effect";

export class UploadFlowApiError extends Schema.TaggedError<UploadFlowApiError>()(
  "@blikka/api-v2/UploadFlowApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const GetPublicMarathonSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  }),
);

export const InitializeUploadFlowSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    competitionClassId: Schema.Number,
    deviceGroupId: Schema.Number,
  }),
);

// By-camera mode: no competition class or device group needed at initialization
export const InitializeByCameraUploadSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
  }),
);

// Finalize by-camera upload: set device group and complete the submission
export const FinalizeByCameraUploadSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    deviceGroupId: Schema.Number,
  }),
);

export const CheckParticipantExistsSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
  }),
);

export const GetUploadStatusSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    orderIndexes: Schema.Array(Schema.Number),
  }),
);
