import { Schema } from 'effect'

export const CreateCompetitionClassInputSchema = Schema.Struct({
  domain: Schema.String,
  data: Schema.Struct({
    name: Schema.String,
    numberOfPhotos: Schema.Number,
    topicStartIndex: Schema.optional(Schema.Number),
    description: Schema.optional(Schema.String),
  }),
})

export const UpdateCompetitionClassInputSchema = Schema.Struct({
  domain: Schema.String,
  id: Schema.Number,
  data: Schema.Struct({
    name: Schema.optional(Schema.String),
    numberOfPhotos: Schema.optional(Schema.Number),
    topicStartIndex: Schema.optional(Schema.Number),
    description: Schema.optional(Schema.String),
  }),
})

export const DeleteCompetitionClassInputSchema = Schema.Struct({
  domain: Schema.String,
  id: Schema.Number,
})

export type CreateCompetitionClassInput = Schema.Schema.Type<
  typeof CreateCompetitionClassInputSchema
>
export type UpdateCompetitionClassInput = Schema.Schema.Type<
  typeof UpdateCompetitionClassInputSchema
>
export type DeleteCompetitionClassInput = Schema.Schema.Type<
  typeof DeleteCompetitionClassInputSchema
>
