import { Schema } from "effect";

export class ParticipantApiError extends Schema.TaggedErrorClass<ParticipantApiError>()(
  "@blikka/api/ParticipantApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export const GetPublicParticipantByReferenceInputSchema =
  Schema.toStandardSchemaV1(
    Schema.Struct({ reference: Schema.String, domain: Schema.String }),
  );

export const GetByDomainInfiniteInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    cursor: Schema.NullishOr(Schema.String),
    limit: Schema.NullishOr(
      Schema.Number.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100)),
    ),
    search: Schema.NullishOr(Schema.String),
    sortOrder: Schema.NullishOr(
      Schema.Literals(["asc", "desc"]),
    ),
    competitionClassId: Schema.NullishOr(
      Schema.Union([Schema.Number, Schema.Array(Schema.Number)]),
    ),
    deviceGroupId: Schema.NullishOr(
      Schema.Union([Schema.Number, Schema.Array(Schema.Number)]),
    ),
    topicId: Schema.NullishOr(Schema.Number),
    statusFilter: Schema.NullishOr(
      Schema.Literals(["completed", "verified"]),
    ),
    excludeStatuses: Schema.NullishOr(Schema.Array(Schema.String)),
    includeStatuses: Schema.NullishOr(Schema.Array(Schema.String)),
    hasValidationErrors: Schema.NullishOr(Schema.Boolean),
    votedFilter: Schema.NullishOr(
      Schema.Literals(["voted", "not-voted"]),
    ),
  }),
);

export const GetByReferenceInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ reference: Schema.String, domain: Schema.String }),
);

export const GetDashboardOverviewInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ domain: Schema.String }),
);

export const BatchDeleteInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    ids: Schema.Array(Schema.Number),
    domain: Schema.String,
  }),
);

export const BatchVerifyInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    ids: Schema.Array(Schema.Number),
    domain: Schema.String,
  }),
);

export const VerifyParticipantInputSchema = Schema.toStandardSchemaV1(
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
      key: Schema.NullOr(Schema.String),
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
