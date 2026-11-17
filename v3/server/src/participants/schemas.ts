import * as Schema from "effect/Schema";

export const Participant = Schema.Struct({
  id: Schema.String,
  competition_id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  signed_in: Schema.Boolean,
  created_at: Schema.Date,
  submissions: Schema.Int,
});

export type Participant = typeof Participant.Type;
