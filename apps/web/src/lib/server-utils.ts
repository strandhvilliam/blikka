import { DEFAULT_LOCALE } from "@/config"
import { Schema, Effect } from "effect"
import { getLocale as getLocaleServer } from "next-intl/server"
import { getTranslations as getTranslationsServer } from "next-intl/server"
import { headers } from "next/headers"

export class TranslationsNotFoundError extends Schema.TaggedErrorClass<TranslationsNotFoundError>()(
  "TranslationsNotFoundError",
  {
    namespace: Schema.optional(Schema.String),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export class HeadersNotFoundError extends Schema.TaggedErrorClass<HeadersNotFoundError>()(
  "HeadersNotFoundError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {
}

export const getLocale = Effect.fnUntraced(
  function* () {
    return yield* Effect.tryPromise(() => getLocaleServer())
  },
  Effect.tapError((error) => Effect.logError(error.message)),
  Effect.catch(() => Effect.succeed(DEFAULT_LOCALE)),
)

export const getTranslations = Effect.fnUntraced(function* (namespace?: string) {
  return yield* Effect.tryPromise({
    try: () => getTranslationsServer(namespace),
    catch: (error) =>
      new TranslationsNotFoundError({
        cause: error,
        message: error instanceof Error ? error.message : "Translations not found",
        namespace,
      }),
  })
})

export const getHeaders = Effect.fnUntraced(function* () {
  return yield* Effect.tryPromise({
    try: () => headers(),
    catch: (error) =>
      new HeadersNotFoundError({
        cause: error,
        message: error instanceof Error ? error.message : "Unable to get headers",
      }),
  })
})
