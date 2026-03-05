import { Schema } from "effect"

export class DeviceGroupApiError extends Schema.TaggedErrorClass<DeviceGroupApiError>()(
  "@blikka/api/device-group-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const CreateDeviceGroupInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      icon: Schema.optional(Schema.String),
      description: Schema.optional(Schema.String),
    }),
  })
)

export const UpdateDeviceGroupInputSchema = Schema.toStandardSchemaV1(
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

export const DeleteDeviceGroupInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    id: Schema.Number,
  })
)

