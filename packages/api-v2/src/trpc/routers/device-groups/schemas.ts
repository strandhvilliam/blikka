import { Schema } from "effect"

export class DeviceGroupApiError extends Schema.TaggedError<DeviceGroupApiError>()(
  "@blikka/api-v2/device-group-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const CreateDeviceGroupInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      icon: Schema.optional(Schema.String),
      description: Schema.optional(Schema.String),
    }),
  })
)

export const UpdateDeviceGroupInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
    data: Schema.Struct({
      name: Schema.optional(Schema.String),
      icon: Schema.optional(Schema.String),
      description: Schema.optional(Schema.String),
    }),
  })
)

export const DeleteDeviceGroupInputSchema = Schema.standardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  })
)

