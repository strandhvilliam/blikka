"use server"

import { LOCALE_COOKIE_NAME } from "@/config"
import { Action, toActionResponse } from "@/lib/next-utils"
import { Effect } from "effect"
import { cookies } from "next/headers"

type FnProps = {
  locale: string
}

const _updateLocaleAction = Effect.fn("@blikka/web/updateLocaleAction")(function* (props: FnProps) {
  const { locale } = props
  const store = yield* Effect.tryPromise(() => cookies())
  store.set(LOCALE_COOKIE_NAME, locale)
}, toActionResponse)

export const updateLocaleAction = async (props: FnProps) => Action(_updateLocaleAction)(props)
