import { Schema } from "effect";

export class TopicApiError extends Schema.TaggedErrorClass<TopicApiError>()(
  "@blikka/api/topic-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const CreateTopicInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      visibility: Schema.Literals(["public", "private", "scheduled", "active"]),
      activate: Schema.optional(Schema.Boolean),
      scheduledStart: Schema.optional(Schema.String),
      scheduledEnd: Schema.optional(Schema.String),
      orderIndex: Schema.optional(Schema.Number),
    }),
  }),
);

export const UpdateTopicInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
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
  }),
);

export const DeleteTopicInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  }),
);

export const UpdateTopicsOrderInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    topicIds: Schema.Array(Schema.Number),
  }),
);

export const GetTopicsWithSubmissionCountInputSchema =
  Schema.toStandardSchemaV1(
    Schema.Struct({
      domain: Schema.String,
    }),
  );

export const ActivateTopicInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  }),
);
