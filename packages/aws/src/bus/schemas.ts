import { Schema } from "effect";

export const FinalizedEventSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
});
