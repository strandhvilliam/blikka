import { Schema } from "effect";

export class VotingApiError extends Schema.TaggedErrorClass<VotingApiError>()(
  "@blikka/api/VotingApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export const GetVotingSessionSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
  }),
);

export const StartVotingSessionsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
  }),
);

export const SetTopicVotingWindowSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    startsAt: Schema.String,
    endsAt: Schema.String,
  }),
);

export const CloseTopicVotingWindowSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
  }),
);

export const GetSubmissionVoteStatsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    submissionId: Schema.Number,
    domain: Schema.String,
  }),
);

export const CreateOrUpdateVotingSessionSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    participantId: Schema.Number,
    domain: Schema.String,
    topicId: Schema.Number,
  }),
);

export const GetVotingSessionByParticipantSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    participantId: Schema.Number,
    topicId: Schema.Number,
    domain: Schema.String,
  }),
);

export const GetVotingAdminSummarySchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
  }),
);

export const GetParticipantsWithoutVotingSessionSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
  }),
);

export const StartVotingSessionsForParticipantsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    participantIds: Schema.Array(Schema.Number),
  }),
);

export const GetVotingLeaderboardPageSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    page: Schema.NullishOr(Schema.Number.check(Schema.isGreaterThan(0))),
    limit: Schema.NullishOr(
      Schema.Number.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100)),
    ),
  }),
);

export const GetVotingVotersPageSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    page: Schema.NullishOr(Schema.Number.check(Schema.isGreaterThan(0))),
    limit: Schema.NullishOr(
      Schema.Number.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100)),
    ),
  }),
);

export const CreateManualVotingSessionSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    firstName: Schema.String,
    lastName: Schema.String,
    email: Schema.String,
  }),
);

export const ResendVotingSessionNotificationSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    sessionId: Schema.Number,
  }),
);

export const GetVotingSubmissionsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
  }),
);

export const SubmitVoteSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    submissionId: Schema.Number,
    domain: Schema.String,
  }),
);

export const ClearVoteSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    sessionId: Schema.Number,
  }),
);

export const DeleteVotingSessionSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicId: Schema.Number,
    sessionId: Schema.Number,
  }),
);
