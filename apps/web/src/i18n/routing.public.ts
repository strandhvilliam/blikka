import { defineRouting } from "next-intl/routing"
import { DEFAULT_LOCALE, LOCALES } from "../config"

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localeDetection: true,
  localePrefix: "as-needed",
})
