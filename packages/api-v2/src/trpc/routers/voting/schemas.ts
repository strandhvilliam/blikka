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
    topicId: Schema.Number,
    startsAt: Schema.String,
    endsAt: Schema.String,
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
    topicId: Schema.Number,
  }),
);

export const GetVotingSessionByParticipantSchema = Schema.standardSchemaV1(
  Schema.Struct({
    participantId: Schema.Number,
    topicId: Schema.Number,
    domain: Schema.String,
  }),
);

export const GetVotingAdminSummarySchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
  }),
);

export const GetVotingLeaderboardPageSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    page: Schema.NullishOr(Schema.Number.pipe(Schema.greaterThan(0))),
    limit: Schema.NullishOr(
      Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(100)),
    ),
  }),
);

export const GetVotingVotersPageSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    page: Schema.NullishOr(Schema.Number.pipe(Schema.greaterThan(0))),
    limit: Schema.NullishOr(
      Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(100)),
    ),
  }),
);

export const CreateManualVotingSessionSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    firstName: Schema.String,
    lastName: Schema.String,
    email: Schema.String,
    startsAt: Schema.String,
    endsAt: Schema.String,
  }),
);

export const ResendVotingSessionNotificationSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    sessionId: Schema.Number,
  }),
);

export const GetVotingSubmissionsSchema = Schema.standardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
  }),
);

export const SubmitVoteSchema = Schema.standardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    submissionId: Schema.Number,
    domain: Schema.String,
  }),
);

export const ClearVoteSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    sessionId: Schema.Number,
  }),
);

export const DeleteVotingSessionSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    sessionId: Schema.Number,
  }),
);
