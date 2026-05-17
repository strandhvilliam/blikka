import { Schema } from 'effect'

export const GetJuryInvitationsByDomainInputSchema = Schema.Struct({ domain: Schema.String })

export const GetJuryInvitationByIdInputSchema = Schema.Struct({
  id: Schema.Number,
})

export const GetJuryReviewResultsByInvitationIdInputSchema = Schema.Struct({
  id: Schema.Number,
})

export const CreateJuryInvitationInputSchema = Schema.Struct({
  domain: Schema.String,
  data: Schema.Struct({
    email: Schema.String,
    displayName: Schema.String,
    inviteType: Schema.Union([Schema.Literal('topic'), Schema.Literal('class')]),
    topicId: Schema.optional(Schema.Number),
    competitionClassId: Schema.optional(Schema.Number),
    deviceGroupId: Schema.optional(Schema.Number),
    expiresAt: Schema.String,
    notes: Schema.optional(Schema.String),
    status: Schema.optional(Schema.String),
  }),
})

export const UpdateJuryInvitationInputSchema = Schema.Struct({
  id: Schema.Number,
  data: Schema.Struct({
    email: Schema.optional(Schema.String),
    displayName: Schema.optional(Schema.String),
    inviteType: Schema.optional(Schema.Union([Schema.Literal('topic'), Schema.Literal('class')])),
    topicId: Schema.optional(Schema.Number),
    competitionClassId: Schema.optional(Schema.Number),
    deviceGroupId: Schema.optional(Schema.Number),
    expiresAt: Schema.optional(Schema.String),
    notes: Schema.optional(Schema.String),
    status: Schema.optional(Schema.String),
    token: Schema.optional(Schema.String),
  }),
})

export const DeleteJuryInvitationInputSchema = Schema.Struct({
  id: Schema.Number,
})

const JuryRatingValueSchema = Schema.Number.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(5),
)

const JuryFinalRankingValueSchema = Schema.Number.check(
  Schema.isGreaterThanOrEqualTo(1),
  Schema.isLessThanOrEqualTo(3),
)

export const VerifyJuryTokenSchema = Schema.Struct({
  token: Schema.String,
  domain: Schema.String,
})

export const GetJurySubmissionsFromTokenSchema = Schema.Struct({
  token: Schema.String,
  domain: Schema.String,
  cursor: Schema.optional(Schema.Number),
  ratingFilter: Schema.optional(Schema.Array(JuryRatingValueSchema)),
})

export const GetJuryRatingsByInvitationSchema = Schema.Struct({
  token: Schema.String,
  domain: Schema.String,
})

export const GetJuryParticipantCountSchema = Schema.Struct({
  token: Schema.String,
  domain: Schema.String,
  ratingFilter: Schema.optional(Schema.Array(JuryRatingValueSchema)),
})

export const CreateJuryRatingSchema = Schema.Struct({
  token: Schema.String,
  domain: Schema.String,
  participantId: Schema.Number,
  rating: JuryRatingValueSchema,
  notes: Schema.optional(Schema.String),
  finalRanking: Schema.optional(Schema.NullOr(JuryFinalRankingValueSchema)),
})

export const UpdateJuryRatingSchema = Schema.Struct({
  token: Schema.String,
  domain: Schema.String,
  participantId: Schema.Number,
  rating: JuryRatingValueSchema,
  notes: Schema.optional(Schema.String),
  finalRanking: Schema.optional(Schema.NullOr(JuryFinalRankingValueSchema)),
})

export const DeleteJuryRatingSchema = Schema.Struct({
  token: Schema.String,
  domain: Schema.String,
  participantId: Schema.Number,
})

export const UpdateJuryInvitationStatusByTokenSchema = Schema.Struct({
  token: Schema.String,
  domain: Schema.String,
  status: Schema.Union([
    Schema.Literal('pending'),
    Schema.Literal('in_progress'),
    Schema.Literal('completed'),
  ]),
})

export type GetJuryInvitationsByDomainInput = Schema.Schema.Type<
  typeof GetJuryInvitationsByDomainInputSchema
>
export type GetJuryInvitationByIdInput = Schema.Schema.Type<typeof GetJuryInvitationByIdInputSchema>
export type GetJuryReviewResultsByInvitationIdInput = Schema.Schema.Type<
  typeof GetJuryReviewResultsByInvitationIdInputSchema
>
export type CreateJuryInvitationInput = Schema.Schema.Type<typeof CreateJuryInvitationInputSchema>
export type UpdateJuryInvitationInput = Schema.Schema.Type<typeof UpdateJuryInvitationInputSchema>
export type DeleteJuryInvitationInput = Schema.Schema.Type<typeof DeleteJuryInvitationInputSchema>
export type VerifyJuryToken = Schema.Schema.Type<typeof VerifyJuryTokenSchema>
export type GetJurySubmissionsFromToken = Schema.Schema.Type<
  typeof GetJurySubmissionsFromTokenSchema
>
export type GetJuryRatingsByInvitation = Schema.Schema.Type<typeof GetJuryRatingsByInvitationSchema>
export type GetJuryParticipantCount = Schema.Schema.Type<typeof GetJuryParticipantCountSchema>
export type CreateJuryRating = Schema.Schema.Type<typeof CreateJuryRatingSchema>
export type UpdateJuryRating = Schema.Schema.Type<typeof UpdateJuryRatingSchema>
export type DeleteJuryRating = Schema.Schema.Type<typeof DeleteJuryRatingSchema>
export type UpdateJuryInvitationStatusByToken = Schema.Schema.Type<
  typeof UpdateJuryInvitationStatusByTokenSchema
>
