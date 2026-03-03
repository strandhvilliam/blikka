import { Schema } from "effect";

export class UploadFlowApiError extends Schema.TaggedError<UploadFlowApiError>()(
  "@blikka/api/UploadFlowApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

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
    phoneNumber: Schema.NullOr(Schema.String).pipe(Schema.optional),
  }),
);

export const InitializeByCameraUploadSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    reference: Schema.String,
    firstname: Schema.String,
    lastname: Schema.String,
    email: Schema.String,
    deviceGroupId: Schema.Number,
    phoneNumber: Schema.NullOr(Schema.String).pipe(Schema.optional),
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
