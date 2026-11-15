import * as Schema from "effect/Schema";

// What a participant sees of a published competition before entering.
export const EntryCompetition = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  description: Schema.String,
  time_zone: Schema.String,
  opens_at: Schema.NullOr(Schema.Date),
  closes_at: Schema.NullOr(Schema.Date),
});

// A participant's own entry. The organizer's view (participants/schemas.ts) grows separately.
export const EntryParticipant = Schema.Struct({
  id: Schema.String,
  competition_id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  created_at: Schema.Date,
});
export type EntryParticipant = typeof EntryParticipant.Type;

export const ParticipantName = Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(100));
export const ParticipantEmail = Schema.Trim.check(Schema.isPattern(/^[^\s@]+@[^\s@]+$/), Schema.isMaxLength(254));
