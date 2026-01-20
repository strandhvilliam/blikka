"use server"

import { Data, Effect } from "effect"
import { Locale } from "next-intl"
import { cookies } from "next/headers"
import { Action, toActionResponse } from "../next-utils"
import { LOCALE_COOKIE_NAME } from "@/config"

class LocaleChangeError extends Data.TaggedError("LocaleChangeError")<{
    message: string
    cause?: unknown
}> { }

const changeLocaleEffect = Effect.fn("@blikka/web/changeLocaleAction")(
    function* (locale: Locale) {
        return yield* Effect.tryPromise({
            try: () => cookies(),
            catch: (error) =>
                new LocaleChangeError({
                    message: error instanceof Error ? error.message : "Failed to get cookies",
                    cause: error,
                }),
        }).pipe(
            Effect.andThen((cookieStore) =>
                Effect.try({
                    try: () => cookieStore.set(LOCALE_COOKIE_NAME, locale),
                    catch: (error) =>
                        new LocaleChangeError({
                            message: error instanceof Error ? error.message : `Failed to set locale cookie`,
                            cause: error,
                        }),
                })
            ),
            Effect.map(() => ({ success: true }))
        )
    },
    toActionResponse
)

export const changeLocaleAction = Action(changeLocaleEffect)
