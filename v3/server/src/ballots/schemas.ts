import * as Schema from "effect/Schema";
import { RoundRules } from "../rounds/schemas.ts";

export const Ballot = Schema.Struct({
  id: Schema.String,
  round_id: Schema.String,
  round_name: Schema.String,
  rules: RoundRules,
  opens_at: Schema.NullOr(Schema.Date),
  closes_at: Schema.NullOr(Schema.Date),
  competition_id: Schema.String,
  competition_name: Schema.String,
  time_zone: Schema.String,
  votes: Schema.Int,
  submitted_at: Schema.NullOr(Schema.Date),
});

export type Ballot = typeof Ballot.Type;

export const BallotEntry = Schema.Struct({
  submission_id: Schema.String,
  number: Schema.Int,
  topic_name: Schema.String,
  topic_position: Schema.Int,
});

export const Vote = Schema.Struct({
  submission_id: Schema.String,
  value: Schema.Int,
  favorite: Schema.Boolean,
  note: Schema.NullOr(Schema.String),
});

export type Vote = typeof Vote.Type;

export const BallotDetail = Schema.Struct({
  ballot: Ballot,
  entries: Schema.Array(BallotEntry),
  votes: Schema.Array(Vote),
});

export const VoteInput = Schema.Struct({
  value: Schema.optionalKey(Schema.Int),
  favorite: Schema.optionalKey(Schema.Boolean),
  note: Schema.optionalKey(Schema.NullOr(Schema.Trim.check(Schema.isMaxLength(2000)))),
});

export type VoteInput = typeof VoteInput.Type;

export class BallotNotFound extends Schema.TaggedError<BallotNotFound>()(
  "BallotNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class RoundNotOpen extends Schema.TaggedError<RoundNotOpen>()("RoundNotOpen", {}, { httpApiStatus: 409 }) {}

export class BallotSubmitted extends Schema.TaggedError<BallotSubmitted>()(
  "BallotSubmitted",
  {},
  { httpApiStatus: 409 },
) {}

export class EntryNotFound extends Schema.TaggedError<EntryNotFound>()("EntryNotFound", {}, { httpApiStatus: 404 }) {}

export class VoteLimitReached extends Schema.TaggedError<VoteLimitReached>()(
  "VoteLimitReached",
  {},
  { httpApiStatus: 409 },
) {}

export class VoteInvalid extends Schema.TaggedError<VoteInvalid>()("VoteInvalid", {}, { httpApiStatus: 400 }) {}
