import { Effect, Schema } from 'effect'

export class InvalidKeyFormatError extends Schema.TaggedErrorClass<InvalidKeyFormatError>()(
  'InvalidKeyFormatError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const parseKey = (key: string) =>
  Effect.sync(() => {
    const parts = key.split('/')
    const [domain, maybeSeedNamespace, maybeReference, maybeOrderIndex, maybeFileName] = parts
    const isSeedKey = maybeSeedNamespace === '__seed'
    const reference = isSeedKey ? maybeReference : maybeSeedNamespace
    const orderIndex = isSeedKey ? maybeOrderIndex : maybeReference
    const fileName = isSeedKey ? maybeFileName : maybeOrderIndex

    if (!domain || !reference || !orderIndex || !fileName) {
      return Effect.fail(
        new InvalidKeyFormatError({
          message: `Missing: domain=${domain}, reference=${reference}, orderIndex=${orderIndex}, fileName=${fileName}`,
        }),
      )
    }
    return Effect.succeed({ domain, reference, orderIndex, fileName })
  }).pipe(Effect.flatten)
