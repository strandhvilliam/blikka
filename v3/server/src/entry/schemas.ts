import * as Schema from "effect/Schema";

export const EntryCompetition = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  description: Schema.String,
  time_zone: Schema.String,
  opens_at: Schema.NullOr(Schema.Date),
  closes_at: Schema.NullOr(Schema.Date),
});

export const EntryParticipant = Schema.Struct({
  id: Schema.String,
  competition_id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  created_at: Schema.Date,
});

export type EntryParticipant = typeof EntryParticipant.Type;

export const EntryTopic = Schema.Struct({
  id: Schema.String,
  position: Schema.Int,
  name: Schema.NullOr(Schema.String),
  status: Schema.Literals(["done", "open", "locked", "missed"]),
  closes_at: Schema.NullOr(Schema.Date),
});

export const EntrySubmission = Schema.Struct({
  id: Schema.String,
  participant_id: Schema.String,
  topic_id: Schema.String,
  created_at: Schema.Date,
  updated_at: Schema.Date,
});

export class TopicNotOpen extends Schema.TaggedError<TopicNotOpen>()("TopicNotOpen", {}, { httpApiStatus: 409 }) {}

export const ParticipantName = Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(100));
export const ParticipantEmail = Schema.Trim.check(Schema.isPattern(/^[^\s@]+@[^\s@]+$/), Schema.isMaxLength(254));

export class GuestDetailsRequired extends Schema.TaggedError<GuestDetailsRequired>()(
  "GuestDetailsRequired",
  {},
  { httpApiStatus: 400 },
) {}

export class EntryClosed extends Schema.TaggedError<EntryClosed>()("EntryClosed", {}, { httpApiStatus: 409 }) {}

export class AlreadyEntered extends Schema.TaggedError<AlreadyEntered>()(
  "AlreadyEntered",
  {},
  { httpApiStatus: 409 },
) {}

export class ParticipantNotFound extends Schema.TaggedError<ParticipantNotFound>()(
  "ParticipantNotFound",
  {},
  { httpApiStatus: 404 },
) {}
