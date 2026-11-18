import * as Schema from "effect/Schema";
import { ParticipantEmail, ParticipantName } from "../entry/schemas.ts";

export const Voter = Schema.Struct({
  id: Schema.String,
  round_id: Schema.String,
  participant_id: Schema.NullOr(Schema.String),
  name: Schema.String,
  email: Schema.String,
  votes: Schema.Int,
  submitted_at: Schema.NullOr(Schema.Date),
  created_at: Schema.Date,
});

export type Voter = typeof Voter.Type;

export const VoterCreate = Schema.Struct({
  round_id: Schema.String.check(Schema.isUUID()),
  name: ParticipantName,
  email: ParticipantEmail,
});

export type VoterCreate = typeof VoterCreate.Type;

export const VoterWithToken = Schema.Struct({ voter: Voter, token: Schema.String });

export class VoterNotFound extends Schema.TaggedError<VoterNotFound>()("VoterNotFound", {}, { httpApiStatus: 404 }) {}

export class NotJuryRound extends Schema.TaggedError<NotJuryRound>()("NotJuryRound", {}, { httpApiStatus: 409 }) {}

export class VoterAlreadyInvited extends Schema.TaggedError<VoterAlreadyInvited>()(
  "VoterAlreadyInvited",
  {},
  { httpApiStatus: 409 },
) {}
