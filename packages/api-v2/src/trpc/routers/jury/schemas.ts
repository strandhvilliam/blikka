import { Schema } from "effect"

export class JuryApiError extends Schema.TaggedError<JuryApiError>()(
  "@blikka/api-v2/jury-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const GetJuryInvitationsByDomainInputSchema = Schema.standardSchemaV1(
  Schema.Struct({ domain: Schema.String })
)

export const GetJuryInvitationByIdInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    id: Schema.Number,
  })
)

export const CreateJuryInvitationInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      email: Schema.String,
      displayName: Schema.String,
      inviteType: Schema.Union(Schema.Literal("topic"), Schema.Literal("class")),
      topicId: Schema.optional(Schema.Number),
      competitionClassId: Schema.optional(Schema.Number),
      deviceGroupId: Schema.optional(Schema.Number),
      expiresAt: Schema.String,
      notes: Schema.optional(Schema.String),
      status: Schema.optional(Schema.String),
    }),
  })
)

export const UpdateJuryInvitationInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    id: Schema.Number,
    data: Schema.Struct({
      email: Schema.optional(Schema.String),
      displayName: Schema.optional(Schema.String),
      inviteType: Schema.optional(
        Schema.Union(Schema.Literal("topic"), Schema.Literal("class"))
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

export const DeleteJuryInvitationInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    id: Schema.Number,
  })
)

