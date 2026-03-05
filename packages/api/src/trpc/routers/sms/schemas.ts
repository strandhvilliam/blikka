import { Schema } from "effect";

export const SendTestSMSInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    phoneNumber: Schema.String,
    message: Schema.String,
  }),
);
