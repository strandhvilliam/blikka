import { Schema } from "effect";

export class TopicApiError extends Schema.TaggedError<TopicApiError>()(
  "@blikka/api/topic-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const CreateTopicInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      visibility: Schema.Union(
        Schema.Literal("public"),
        Schema.Literal("private"),
        Schema.Literal("scheduled"),
        Schema.Literal("active"),
      ),
      activate: Schema.optional(Schema.Boolean),
      scheduledStart: Schema.optional(Schema.String),
      orderIndex: Schema.optional(Schema.Number),
    }),
  }),
);

export const UpdateTopicInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
    data: Schema.Struct({
      name: Schema.optional(Schema.String),
      visibility: Schema.optional(
        Schema.Union(
          Schema.Literal("public"),
          Schema.Literal("private"),
          Schema.Literal("scheduled"),
          Schema.Literal("active"),
        ),
      ),
      scheduledStart: Schema.optional(Schema.NullishOr(Schema.String)),
      orderIndex: Schema.optional(Schema.Number),
    }),
  }),
);

export const DeleteTopicInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  }),
);

export const UpdateTopicsOrderInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicIds: Schema.Array(Schema.Number),
  }),
);

export const GetTopicsWithSubmissionCountInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  }),
);

export const ActivateTopicInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  }),
);
