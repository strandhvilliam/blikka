import { Schema } from "effect"

export class CompetitionClassApiError extends Schema.TaggedError<CompetitionClassApiError>()(
  "@blikka/api-v2/competition-class-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const CreateCompetitionClassInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      numberOfPhotos: Schema.Number,
      topicStartIndex: Schema.optional(Schema.Number),
      description: Schema.optional(Schema.String),
    }),
  })
)

export const UpdateCompetitionClassInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
    data: Schema.Struct({
      name: Schema.optional(Schema.String),
      numberOfPhotos: Schema.optional(Schema.Number),
      topicStartIndex: Schema.optional(Schema.Number),
      description: Schema.optional(Schema.String),
    }),
  })
)

export const DeleteCompetitionClassInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  })
)

