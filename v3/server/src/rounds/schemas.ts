import * as Schema from "effect/Schema";

const Id = Schema.String.check(Schema.isUUID());

export const PickRules = Schema.Struct({
  method: Schema.Literal("pick"),
  max_votes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(100)),
  favorite: Schema.Boolean,
});

export const RatingRules = Schema.Struct({
  method: Schema.Literal("rating"),
  scale: Schema.Literals([5, 10]),
});

export const RoundRules = Schema.Union([PickRules, RatingRules]);

export type RoundRules = typeof RoundRules.Type;

export const VoterKind = Schema.Literals(["jury", "participants"]);

export type VoterKind = typeof VoterKind.Type;

export const Round = Schema.Struct({
  id: Schema.String,
  competition_id: Schema.String,
  name: Schema.String,
  rules: RoundRules,
  voters: VoterKind,
  topic_id: Schema.NullOr(Schema.String),
  source_round_id: Schema.NullOr(Schema.String),
  opens_at: Schema.NullOr(Schema.Date),
  closes_at: Schema.NullOr(Schema.Date),
  entries: Schema.Int,
  voted: Schema.Int,
});

export type Round = typeof Round.Type;

export const RoundName = Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(100));

export const RoundCreate = Schema.Struct({
  competition_id: Id,
  name: RoundName,
  rules: RoundRules,
  voters: VoterKind,
  topic_id: Schema.optionalKey(Schema.NullOr(Id)),
  source_round_id: Schema.optionalKey(Id),
  submission_ids: Schema.optionalKey(Schema.Array(Id).check(Schema.isMinLength(1), Schema.isMaxLength(1000))),
});

export type RoundCreate = typeof RoundCreate.Type;

export const RoundUpdate = Schema.Struct({
  name: Schema.optionalKey(RoundName),
  closes_at: Schema.optionalKey(Schema.NullOr(Schema.Date)),
});

export type RoundUpdate = typeof RoundUpdate.Type;

export const RoundOpen = Schema.Struct({
  closes_at: Schema.optionalKey(Schema.NullOr(Schema.Date)),
});

export const Result = Schema.Struct({
  submission_id: Schema.String,
  participant_id: Schema.String,
  participant_name: Schema.String,
  topic_id: Schema.String,
  topic_name: Schema.String,
  topic_position: Schema.Int,
  votes: Schema.Int,
  favorites: Schema.Int,
  average: Schema.NullOr(Schema.Finite),
  rank: Schema.Int,
});

export type Result = typeof Result.Type;

export class RoundNotFound extends Schema.TaggedError<RoundNotFound>()("RoundNotFound", {}, { httpApiStatus: 404 }) {}

export class RoundStarted extends Schema.TaggedError<RoundStarted>()("RoundStarted", {}, { httpApiStatus: 409 }) {}

export class RoundHasNoEntries extends Schema.TaggedError<RoundHasNoEntries>()(
  "RoundHasNoEntries",
  {},
  { httpApiStatus: 409 },
) {}

export class SourceRoundNotClosed extends Schema.TaggedError<SourceRoundNotClosed>()(
  "SourceRoundNotClosed",
  {},
  { httpApiStatus: 409 },
) {}

export class RoundEntriesInvalid extends Schema.TaggedError<RoundEntriesInvalid>()(
  "RoundEntriesInvalid",
  {},
  { httpApiStatus: 400 },
) {}

export class RoundWindowInvalid extends Schema.TaggedError<RoundWindowInvalid>()(
  "RoundWindowInvalid",
  {},
  { httpApiStatus: 400 },
) {}
