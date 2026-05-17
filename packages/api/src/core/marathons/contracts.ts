import { Schema } from 'effect'

export const GetByDomainInputSchema = Schema.Struct({ domain: Schema.String })

export const GetUserMarathonsInputSchema = Schema.Struct({
  userId: Schema.String,
})

export const UpdateMarathonInputSchema = Schema.Struct({
  domain: Schema.String,
  data: Schema.Struct({
    name: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
    startDate: Schema.optional(Schema.String),
    endDate: Schema.optional(Schema.String),
    logoUrl: Schema.optional(Schema.String),
    languages: Schema.optional(Schema.String),
    termsAndConditionsKey: Schema.optional(Schema.String),
  }),
})

export const ResetMarathonInputSchema = Schema.Struct({
  domain: Schema.String,
})

export const GetLogoUploadUrlInputSchema = Schema.Struct({
  domain: Schema.String,
  currentKey: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
})

export const GetTermsUploadUrlInputSchema = Schema.Struct({
  domain: Schema.String,
})

export const GetCurrentTermsInputSchema = Schema.Struct({
  domain: Schema.String,
})

export type GetByDomainInput = Schema.Schema.Type<typeof GetByDomainInputSchema>
export type GetUserMarathonsInput = Schema.Schema.Type<typeof GetUserMarathonsInputSchema>
export type UpdateMarathonInput = Schema.Schema.Type<typeof UpdateMarathonInputSchema>
export type ResetMarathonInput = Schema.Schema.Type<typeof ResetMarathonInputSchema>
export type GetLogoUploadUrlInput = Schema.Schema.Type<typeof GetLogoUploadUrlInputSchema>
export type GetTermsUploadUrlInput = Schema.Schema.Type<typeof GetTermsUploadUrlInputSchema>
export type GetCurrentTermsInput = Schema.Schema.Type<typeof GetCurrentTermsInputSchema>
