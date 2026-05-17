"use server"

import { Locale } from "next-intl"
import { cookies } from "next/headers"
import { LOCALE_COOKIE_NAME } from "@/config"

export async function changeLocaleAction(locale: Locale) {
  try {
    const cookieStore = await cookies()
    cookieStore.set(LOCALE_COOKIE_NAME, locale)
    return { data: { success: true }, error: null }
  } catch (error) {
    return {
      data: undefined,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
