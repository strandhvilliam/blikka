import { Schema } from "effect"

export class RulesApiError extends Schema.TaggedErrorClass<RulesApiError>()(
  "@blikka/api/RulesApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export const GetByDomainInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ domain: Schema.String })
)

export const UpdateMultipleInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Array(
      Schema.Struct({
        ruleKey: Schema.String,
        params: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
        severity: Schema.optional(Schema.String),
        enabled: Schema.optional(Schema.Boolean),
      })
    ),
  })
)
