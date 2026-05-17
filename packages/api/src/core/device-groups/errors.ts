import { Schema } from "effect"

export class DeviceGroupApiError extends Schema.TaggedErrorClass<DeviceGroupApiError>()(
  "@blikka/api/device-group-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}
