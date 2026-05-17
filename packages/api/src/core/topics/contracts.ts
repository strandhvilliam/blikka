import { Schema } from "effect";

export const CreateTopicInputSchema = Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      visibility: Schema.Literals(["public", "private", "scheduled", "active"]),
      activate: Schema.optional(Schema.Boolean),
      scheduledStart: Schema.optional(Schema.String),
      scheduledEnd: Schema.optional(Schema.String),
      orderIndex: Schema.optional(Schema.Number),
    }),
  });

export const UpdateTopicInputSchema = Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
    data: Schema.Struct({
      name: Schema.optional(Schema.String),
      visibility: Schema.optional(
        Schema.Literals(["public", "private", "scheduled", "active"]),
      ),
      scheduledStart: Schema.optional(Schema.NullishOr(Schema.String)),
      scheduledEnd: Schema.optional(Schema.NullishOr(Schema.String)),
      orderIndex: Schema.optional(Schema.Number),
    }),
  });

export const DeleteTopicInputSchema = Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  });

export const UpdateTopicsOrderInputSchema = Schema.Struct({
    domain: Schema.String,
    topicIds: Schema.Array(Schema.Number),
  });

export const GetTopicsWithSubmissionCountInputSchema =
  Schema.Struct({
      domain: Schema.String,
    });

export const ActivateTopicInputSchema = Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  });

export type CreateTopicInput = Schema.Schema.Type<typeof CreateTopicInputSchema>
export type UpdateTopicInput = Schema.Schema.Type<typeof UpdateTopicInputSchema>
export type DeleteTopicInput = Schema.Schema.Type<typeof DeleteTopicInputSchema>
export type UpdateTopicsOrderInput = Schema.Schema.Type<typeof UpdateTopicsOrderInputSchema>
export type GetTopicsWithSubmissionCountInput = Schema.Schema.Type<typeof GetTopicsWithSubmissionCountInputSchema>
export type ActivateTopicInput = Schema.Schema.Type<typeof ActivateTopicInputSchema>
