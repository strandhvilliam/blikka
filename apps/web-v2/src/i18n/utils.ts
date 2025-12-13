import { Data, Effect } from "effect"
import { getMessages } from "next-intl/server"

export class I18nError extends Data.TaggedError("MessagesNotFoundError")<{
  cause?: unknown
  message?: string
}> {}

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
