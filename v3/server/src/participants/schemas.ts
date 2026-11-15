import * as Schema from "effect/Schema";

// The organizer's view of an entry.
export const Participant = Schema.Struct({
  id: Schema.String,
  competition_id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  // False for a guest.
  signed_in: Schema.Boolean,
  created_at: Schema.Date,
});

export type Participant = typeof Participant.Type;
