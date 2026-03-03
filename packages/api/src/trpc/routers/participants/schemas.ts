import { Schema } from "effect";

export class ParticipantApiError extends Schema.TaggedError<ParticipantApiError>()(
  "@blikka/api/ParticipantApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const GetPublicParticipantByReferenceInputSchema =
  Schema.standardSchemaV1(
    Schema.Struct({ reference: Schema.String, domain: Schema.String }),
  );

export const GetByDomainInfiniteInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    cursor: Schema.NullishOr(Schema.String),
    limit: Schema.NullishOr(
      Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(100)),
    ),
    search: Schema.NullishOr(Schema.String),
    sortOrder: Schema.NullishOr(
      Schema.Union(Schema.Literal("asc"), Schema.Literal("desc")),
    ),
    competitionClassId: Schema.NullishOr(
      Schema.Union(Schema.Number, Schema.Array(Schema.Number)),
    ),
    deviceGroupId: Schema.NullishOr(
      Schema.Union(Schema.Number, Schema.Array(Schema.Number)),
    ),
    topicId: Schema.NullishOr(Schema.Number),
    statusFilter: Schema.NullishOr(
      Schema.Union(Schema.Literal("completed"), Schema.Literal("verified")),
    ),
    excludeStatuses: Schema.NullishOr(Schema.Array(Schema.String)),
    hasValidationErrors: Schema.NullishOr(Schema.Boolean),
  }),
);

export const GetByReferenceInputSchema = Schema.standardSchemaV1(
  Schema.Struct({ reference: Schema.String, domain: Schema.String }),
);

export const BatchDeleteInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    ids: Schema.Array(Schema.Number),
    domain: Schema.String,
  }),
);

export const BatchVerifyInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    ids: Schema.Array(Schema.Number),
    domain: Schema.String,
  }),
);

export const VerifyParticipantInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    id: Schema.Number,
    domain: Schema.String,
  }),
);

export const PublicParticipantSchema = Schema.Struct({
  reference: Schema.String,
  domain: Schema.String,
  status: Schema.String,
  publicSubmissions: Schema.Array(
    Schema.Struct({
      topic: Schema.Struct({
        name: Schema.String,
        orderIndex: Schema.Number,
      }),
      status: Schema.String,
      createdAt: Schema.String,
      thumbnailKey: Schema.NullOr(Schema.String),
    }),
  ),
  competitionClass: Schema.Struct({
    name: Schema.String,
    description: Schema.String,
  }),
  deviceGroup: Schema.Struct({
    name: Schema.String,
    description: Schema.String,
    icon: Schema.String,
  }),
});
