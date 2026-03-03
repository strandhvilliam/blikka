import { Schema } from "effect";

export const SendTestSMSInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    phoneNumber: Schema.String,
    message: Schema.String,
  }),
);
