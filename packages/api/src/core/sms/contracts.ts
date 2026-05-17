import { Schema } from 'effect'

export const SendTestSMSInputSchema = Schema.Struct({
  phoneNumber: Schema.String,
  message: Schema.String,
})

export type SendTestSMSInput = Schema.Schema.Type<typeof SendTestSMSInputSchema>
