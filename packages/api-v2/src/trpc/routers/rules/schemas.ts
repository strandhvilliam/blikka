import { Schema } from "effect"

export class RulesApiError extends Schema.TaggedError<RulesApiError>()(
  "@blikka/api-v2/RulesApiError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export const GetByDomainInputSchema = Schema.standardSchemaV1(
  Schema.Struct({ domain: Schema.String })
)

export const UpdateMultipleInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Array(
      Schema.Struct({
        ruleKey: Schema.String,
        params: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
        severity: Schema.optional(Schema.String),
        enabled: Schema.optional(Schema.Boolean),
      })
    ),
  })
)
