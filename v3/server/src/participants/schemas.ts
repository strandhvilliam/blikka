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

// A guest has no account to take them from.
export class GuestDetailsRequired extends Schema.TaggedError<GuestDetailsRequired>()(
  "GuestDetailsRequired",
  {},
  { httpApiStatus: 400 },
) {}

// The competition is past closes_at.
export class EntryClosed extends Schema.TaggedError<EntryClosed>()("EntryClosed", {}, { httpApiStatus: 409 }) {}

// A guest can't enter with an email that already has an entry; signing in with it takes that entry over.
export class AlreadyEntered extends Schema.TaggedError<AlreadyEntered>()("AlreadyEntered", {}, { httpApiStatus: 409 }) {}

// Also for entries the caller doesn't own, so ids can't be probed.
export class ParticipantNotFound extends Schema.TaggedError<ParticipantNotFound>()(
  "ParticipantNotFound",
  {},
  { httpApiStatus: 404 },
) {}
