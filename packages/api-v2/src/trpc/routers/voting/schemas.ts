import { Schema } from "effect";

export class VotingApiError extends Schema.TaggedError<VotingApiError>()(
  "@blikka/api-v2/VotingApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const GetVotingSessionSchema = Schema.standardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
  }),
);

export const StartVotingSessionsSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  }),
);

export const GetSubmissionVoteStatsSchema = Schema.standardSchemaV1(
  Schema.Struct({
    submissionId: Schema.Number,
    domain: Schema.String,
  }),
);

export const CreateOrUpdateVotingSessionSchema = Schema.standardSchemaV1(
  Schema.Struct({
    participantId: Schema.Number,
    domain: Schema.String,
  }),
);

export const GetVotingSessionByParticipantSchema = Schema.standardSchemaV1(
  Schema.Struct({
    participantId: Schema.Number,
    domain: Schema.String,
  }),
);
