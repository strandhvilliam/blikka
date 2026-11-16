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

// One of a participant's topics, in position order, with its status from availableTopics (adr/0009).
export const EntryTopic = Schema.Struct({
  id: Schema.String,
  position: Schema.Int,
  // Null while locked, so it can't be read from the network.
  name: Schema.NullOr(Schema.String),
  status: Schema.Literals(["done", "open", "locked", "missed"]),
});

// A topic the participant delivered. No file yet: uploads attach one later.
export const EntrySubmission = Schema.Struct({
  id: Schema.String,
  participant_id: Schema.String,
  topic_id: Schema.String,
  created_at: Schema.Date,
  updated_at: Schema.Date,
});

// Locked or missed; a done topic can be replaced only while it would still be open.
export class TopicNotOpen extends Schema.TaggedError<TopicNotOpen>()("TopicNotOpen", {}, { httpApiStatus: 409 }) {}

export const ParticipantName = Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(100));
export const ParticipantEmail = Schema.Trim.check(Schema.isPattern(/^[^\s@]+@[^\s@]+$/), Schema.isMaxLength(254));

// A guest has no account to take them from.
export class GuestDetailsRequired extends Schema.TaggedError<GuestDetailsRequired>()(
  "GuestDetailsRequired",
  {},
  { httpApiStatus: 400 },
) {}

// The competition is past closes_at.
export class EntryClosed extends Schema.TaggedError<EntryClosed>()("EntryClosed", {}, { httpApiStatus: 409 }) {}

// A guest can't enter with an email that already has an entry; signing in with it takes that entry over.
export class AlreadyEntered extends Schema.TaggedError<AlreadyEntered>()(
  "AlreadyEntered",
  {},
  { httpApiStatus: 409 },
) {}

// Also for entries the caller doesn't own, or an organizer can't read, so ids can't be probed.
export class ParticipantNotFound extends Schema.TaggedError<ParticipantNotFound>()(
  "ParticipantNotFound",
  {},
  { httpApiStatus: 404 },
) {}
