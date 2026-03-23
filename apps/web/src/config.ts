import { Locale } from "next-intl"

export const LOCALES = ["en", "sv"] satisfies Locale[]

export const DEFAULT_LOCALE: Locale = "en"

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE"

/** IANA zone for Central European Time (CET / CEST). Keeps server and client next-intl in sync. */
export const APP_TIME_ZONE = "Europe/Berlin"

export const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
export const rootDomain =
  protocol === "https"
    ? (process.env.NEXT_PUBLIC_BLIKKA_PRODUCTION_URL || "blikka.app")
    : "localhost:3002"
