import { Schema } from 'effect'

export const GetByDomainInputSchema = Schema.Struct({ domain: Schema.String })

export const UpdateMultipleInputSchema = Schema.Struct({
  domain: Schema.String,
  data: Schema.Array(
    Schema.Struct({
      ruleKey: Schema.String,
      params: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
      severity: Schema.optional(Schema.String),
      enabled: Schema.optional(Schema.Boolean),
    }),
  ),
})

export type GetByDomainInput = Schema.Schema.Type<typeof GetByDomainInputSchema>
export type UpdateMultipleInput = Schema.Schema.Type<typeof UpdateMultipleInputSchema>
