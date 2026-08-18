import { Schema } from 'effect'

export const GenerateContactSheetSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export type GenerateContactSheet = Schema.Schema.Type<typeof GenerateContactSheetSchema>

export const SendContactSheetConfirmationEmailSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export type SendContactSheetConfirmationEmail = Schema.Schema.Type<
  typeof SendContactSheetConfirmationEmailSchema
>
