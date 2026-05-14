import { Effect, Schema } from "effect"

export class UploadObjectKeyFormatError extends Schema.TaggedErrorClass<UploadObjectKeyFormatError>()(
  "UploadObjectKeyFormatError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const parseUploadObjectKey = Effect.fnUntraced(function* (key: string) {
  const [domain, reference, formattedOrderIndex, ...fileNameParts] = key.split("/")
  const fileName = fileNameParts.join("/")

  if (!domain || !reference || !formattedOrderIndex || !fileName) {
    return yield* new UploadObjectKeyFormatError({
      message: `Missing: domain=${domain}, reference=${reference}, orderIndex=${formattedOrderIndex}, fileName=${fileName}`,
    })
  }

  const orderIndex = Number(formattedOrderIndex) - 1
  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    return yield* new UploadObjectKeyFormatError({
      message: `Invalid orderIndex=${formattedOrderIndex}`,
    })
  }

  return { domain, reference, orderIndex, fileName }
})
