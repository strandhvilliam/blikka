import { Schema } from 'effect'

export const GetVotingSessionSchema = Schema.Struct({
  token: Schema.String,
})

export const StartVotingSessionsSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  endsAt: Schema.optional(Schema.NullishOr(Schema.String)),
  sendInitialSms: Schema.optional(Schema.Boolean),
})

export const CloseTopicVotingWindowSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
})

export const ReopenTopicVotingWindowSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
})

export const StartTiebreakRoundSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  endsAt: Schema.optional(Schema.NullishOr(Schema.String)),
})

export const GetSubmissionVoteStatsSchema = Schema.Struct({
  submissionId: Schema.Number,
  domain: Schema.String,
})

export const GetVotingAdminSummarySchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
})

export const GetVotingRoundsForTopicSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
})

export const GetParticipantsWithoutVotingSessionSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
})

export const StartVotingSessionsForParticipantsSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  participantIds: Schema.Array(Schema.Number),
})

export const GetVotingLeaderboardPageSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  page: Schema.NullishOr(Schema.Number.check(Schema.isGreaterThan(0))),
  limit: Schema.NullishOr(
    Schema.Number.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100)),
  ),
  roundId: Schema.optional(Schema.Number.check(Schema.isGreaterThan(0))),
})

export const GetVotingVotersPageSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  page: Schema.NullishOr(Schema.Number.check(Schema.isGreaterThan(0))),
  limit: Schema.NullishOr(
    Schema.Number.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100)),
  ),
})

export const CreateManualVotingSessionSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
})

export const ResendVotingSessionNotificationSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  sessionId: Schema.Number,
  channel: Schema.optional(Schema.Literals(['email', 'sms'])),
})

export const UpdateVotingSessionContactSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  sessionId: Schema.Number,
  email: Schema.optional(Schema.String),
  phoneNumber: Schema.optional(Schema.String),
})

export const GetVotingSubmissionsSchema = Schema.Struct({
  token: Schema.String,
})

export const SubmitVoteSchema = Schema.Struct({
  token: Schema.String,
  submissionId: Schema.Number,
})

export const ClearVoteSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  sessionId: Schema.Number,
})

export const DeleteVotingSessionSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  sessionId: Schema.Number,
})

export type GetVotingSession = Schema.Schema.Type<typeof GetVotingSessionSchema>
export type StartVotingSessions = Schema.Schema.Type<typeof StartVotingSessionsSchema>
export type CloseTopicVotingWindow = Schema.Schema.Type<typeof CloseTopicVotingWindowSchema>
export type ReopenTopicVotingWindow = Schema.Schema.Type<typeof ReopenTopicVotingWindowSchema>
export type StartTiebreakRound = Schema.Schema.Type<typeof StartTiebreakRoundSchema>
export type GetSubmissionVoteStats = Schema.Schema.Type<typeof GetSubmissionVoteStatsSchema>
export type GetVotingAdminSummary = Schema.Schema.Type<typeof GetVotingAdminSummarySchema>
export type GetVotingRoundsForTopic = Schema.Schema.Type<typeof GetVotingRoundsForTopicSchema>
export type GetParticipantsWithoutVotingSession = Schema.Schema.Type<
  typeof GetParticipantsWithoutVotingSessionSchema
>
export type StartVotingSessionsForParticipants = Schema.Schema.Type<
  typeof StartVotingSessionsForParticipantsSchema
>
export type GetVotingLeaderboardPage = Schema.Schema.Type<typeof GetVotingLeaderboardPageSchema>
export type GetVotingVotersPage = Schema.Schema.Type<typeof GetVotingVotersPageSchema>
export type CreateManualVotingSession = Schema.Schema.Type<typeof CreateManualVotingSessionSchema>
export type ResendVotingSessionNotification = Schema.Schema.Type<
  typeof ResendVotingSessionNotificationSchema
>
export type UpdateVotingSessionContact = Schema.Schema.Type<typeof UpdateVotingSessionContactSchema>
export type GetVotingSubmissions = Schema.Schema.Type<typeof GetVotingSubmissionsSchema>
export type SubmitVote = Schema.Schema.Type<typeof SubmitVoteSchema>
export type ClearVote = Schema.Schema.Type<typeof ClearVoteSchema>
export type DeleteVotingSession = Schema.Schema.Type<typeof DeleteVotingSessionSchema>
