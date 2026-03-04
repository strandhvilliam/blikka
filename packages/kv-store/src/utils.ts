import { Data, Effect, Schema } from "effect"

export class InvalidKeyFormatError extends Schema.TaggedErrorClass<InvalidKeyFormatError>()(
  "InvalidKeyFormatError",
  {
    message: Schema.String,
  }
) {
}

export const parseKey = Effect.fn("utils.parseKey")(function* (key: string) {
  const [domain, reference, formattedOrderIndex, fileName] = key.split("/")
  if (!domain || !reference || !formattedOrderIndex || !fileName) {
    return yield* new InvalidKeyFormatError({
      message: `Missing: domain=${domain}, reference=${reference}, orderIndex=${formattedOrderIndex}, fileName=${fileName}`,
    })
  }
  const orderIndex = Number(formattedOrderIndex) - 1
  return {
    domain,
    reference,
    orderIndex,
    fileName,
  }
})
