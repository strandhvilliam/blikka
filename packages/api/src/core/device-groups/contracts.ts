import { Schema } from 'effect'

export const CreateDeviceGroupInputSchema = Schema.Struct({
  domain: Schema.String,
  data: Schema.Struct({
    name: Schema.String,
    icon: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
  }),
})

export const UpdateDeviceGroupInputSchema = Schema.Struct({
  domain: Schema.String,
  id: Schema.Number,
  data: Schema.Struct({
    name: Schema.optional(Schema.String),
    icon: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
  }),
})

export const DeleteDeviceGroupInputSchema = Schema.Struct({
  domain: Schema.String,
  id: Schema.Number,
})

export type CreateDeviceGroupInput = Schema.Schema.Type<typeof CreateDeviceGroupInputSchema>
export type UpdateDeviceGroupInput = Schema.Schema.Type<typeof UpdateDeviceGroupInputSchema>
export type DeleteDeviceGroupInput = Schema.Schema.Type<typeof DeleteDeviceGroupInputSchema>
