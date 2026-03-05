import { Schema } from "effect"

export class JuryApiError extends Schema.TaggedErrorClass<JuryApiError>()(
  "@blikka/api/jury-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const GetJuryInvitationsByDomainInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ domain: Schema.String })
)

export const GetJuryInvitationByIdInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    id: Schema.Number,
  })
)

export const CreateJuryInvitationInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      email: Schema.String,
      displayName: Schema.String,
      inviteType: Schema.Union([Schema.Literal("topic"), Schema.Literal("class")]),
      topicId: Schema.optional(Schema.Number),
      competitionClassId: Schema.optional(Schema.Number),
      deviceGroupId: Schema.optional(Schema.Number),
      expiresAt: Schema.String,
      notes: Schema.optional(Schema.String),
      status: Schema.optional(Schema.String),
    }),
  })
)

export const UpdateJuryInvitationInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    id: Schema.Number,
    data: Schema.Struct({
      email: Schema.optional(Schema.String),
      displayName: Schema.optional(Schema.String),
      inviteType: Schema.optional(
        Schema.Union([Schema.Literal("topic"), Schema.Literal("class")])
      ),
      topicId: Schema.optional(Schema.Number),
      competitionClassId: Schema.optional(Schema.Number),
      deviceGroupId: Schema.optional(Schema.Number),
      expiresAt: Schema.optional(Schema.String),
      notes: Schema.optional(Schema.String),
      status: Schema.optional(Schema.String),
      token: Schema.optional(Schema.String),
    }),
  })
)

export const DeleteJuryInvitationInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    id: Schema.Number,
  })
)

const JuryRatingValueSchema = Schema.Number.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(5)
)

export const VerifyJuryTokenSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
  })
)

export const GetJurySubmissionsFromTokenSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
    cursor: Schema.optional(Schema.Number),
    ratingFilter: Schema.optional(Schema.Array(JuryRatingValueSchema)),
  })
)

export const GetJuryRatingsByInvitationSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
  })
)

export const GetJuryParticipantCountSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
    ratingFilter: Schema.optional(Schema.Array(JuryRatingValueSchema)),
  })
)

export const CreateJuryRatingSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
    participantId: Schema.Number,
    rating: JuryRatingValueSchema,
    notes: Schema.optional(Schema.String),
  })
)

export const UpdateJuryRatingSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
    participantId: Schema.Number,
    rating: JuryRatingValueSchema,
    notes: Schema.optional(Schema.String),
    finalRanking: Schema.optional(Schema.Number),
  })
)

export const GetJuryRatingSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
    participantId: Schema.Number,
  })
)

export const DeleteJuryRatingSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
    participantId: Schema.Number,
  })
)

export const UpdateJuryInvitationStatusByTokenSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    token: Schema.String,
    domain: Schema.String,
    status: Schema.Union([
      Schema.Literal("pending"),
      Schema.Literal("in_progress"),
      Schema.Literal("completed")
    ]),
  })
)
