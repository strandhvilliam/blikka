import { Effect, Schema } from "effect"
import { getMessages } from "next-intl/server"

export class I18nError extends Schema.TaggedErrorClass<I18nError>()("MessagesNotFoundError", {
  cause: Schema.optional(Schema.Unknown),
  message: Schema.String,
}) {
}

export const getI18nMessages = Effect.fnUntraced(function* () {
  return yield* Effect.tryPromise({
    try: () => getMessages(),
    catch: (error) =>
      new I18nError({
        cause: error,
        message: error instanceof Error ? error.message : "Messages not found",
      }),
  })
})
