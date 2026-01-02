import { Schema } from "effect"

export class ParticipantApiError extends Schema.TaggedError<ParticipantApiError>()(
  "@blikka/api-v2/ParticipantApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const GetByDomainInfiniteInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    cursor: Schema.NullishOr(Schema.String),
    limit: Schema.NullishOr(
      Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(100))
    ),
    search: Schema.NullishOr(Schema.String),
    sortOrder: Schema.NullishOr(Schema.Union(Schema.Literal("asc"), Schema.Literal("desc"))),
    competitionClassId: Schema.NullishOr(Schema.Union(Schema.Number, Schema.Array(Schema.Number))),
    deviceGroupId: Schema.NullishOr(Schema.Union(Schema.Number, Schema.Array(Schema.Number))),
    statusFilter: Schema.NullishOr(
      Schema.Union(Schema.Literal("completed"), Schema.Literal("verified"))
    ),
    excludeStatuses: Schema.NullishOr(Schema.Array(Schema.String)),
    hasValidationErrors: Schema.NullishOr(Schema.Boolean),
  })
)

export const GetByReferenceInputSchema = Schema.standardSchemaV1(
  Schema.Struct({ reference: Schema.String, domain: Schema.String })
)
