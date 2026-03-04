import { Effect } from "effect"
import { JsonParseError, InvalidKeyFormatError } from "./errors"

export const parseJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (unknown) => new JsonParseError({ message: "Failed to parse JSON" }),
  })

export const parseKey = Effect.fn("UploadProcessorUtils.parseKey")(function* (key: string) {
  const [domain, reference, formattedOrderIndex, fileName] = key.split("/")
  if (!domain || !reference || !formattedOrderIndex || !fileName) {
    return yield* new InvalidKeyFormatError({
      message: `Missing: domain=${domain}, reference=${reference}, orderIndex=${formattedOrderIndex}, fileName=${fileName}`,
    })
  }

  const orderIndex = Number(formattedOrderIndex) - 1

  return { domain, reference, orderIndex, fileName }
})

export const makeThumbnailKey = (params: {
  domain: string
  reference: string
  orderIndex: number
  fileName: string
}) => {
  const formattedOrderIndex = (params.orderIndex + 1).toString().padStart(2, "0")
  return `${params.domain}/${params.reference}/${formattedOrderIndex}/thumbnail_${params.fileName}`
}
