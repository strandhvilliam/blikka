import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { LOCALE_COOKIE_NAME, DEFAULT_LOCALE, LOCALES } from "../config"
import { cookies } from "next/headers"

export default getRequestConfig(async ({ requestLocale }) => {
  // Read from potential `[locale]` segment
  // if the user is on a public page
  let candidate = await requestLocale

  if (!candidate) {
    // Read from cookie if the user is logged in
    const store = await cookies()
    candidate = store.get(LOCALE_COOKIE_NAME)?.value
  }

  const locale = hasLocale(LOCALES, candidate) ? candidate : DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`./dictionary/${locale}.json`)).default,
    timeZone: "Europe/Stockholm",
  }
})
