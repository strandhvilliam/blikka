import { Schema } from "effect"

export class CompetitionClassApiError extends Schema.TaggedErrorClass<CompetitionClassApiError>()(
  "@blikka/api/competition-class-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export const CreateCompetitionClassInputSchema = Schema.toStandardSchemaV1(
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

export const UpdateCompetitionClassInputSchema = Schema.toStandardSchemaV1(
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

export const DeleteCompetitionClassInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  })
)

