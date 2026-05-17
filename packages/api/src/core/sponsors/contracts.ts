import { Schema } from 'effect'

export const GetSponsorsByMarathonInputSchema = Schema.Struct({
  domain: Schema.String,
})

export const CreateSponsorInputSchema = Schema.Struct({
  domain: Schema.String,
  type: Schema.Literals(['contact-sheets', 'live-landing', 'live-success-1', 'live-success-2']),
  position: Schema.Literals(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
  key: Schema.String,
})

export const GenerateSponsorUploadUrlInputSchema = Schema.Struct({
  domain: Schema.String,
  type: Schema.Literals(['contact-sheets', 'live-landing', 'live-success-1', 'live-success-2']),
  position: Schema.Literals(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
})

export type GetSponsorsByMarathonInput = Schema.Schema.Type<typeof GetSponsorsByMarathonInputSchema>
export type CreateSponsorInput = Schema.Schema.Type<typeof CreateSponsorInputSchema>
export type GenerateSponsorUploadUrlInput = Schema.Schema.Type<
  typeof GenerateSponsorUploadUrlInputSchema
>
