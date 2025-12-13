import { Locale } from "next-intl"

export const LOCALES = ["en", "sv"] satisfies Locale[]

export const DEFAULT_LOCALE: Locale = "en"

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE"

export const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
export const rootDomain = process.env.BLIKKA_PRODUCTION_URL || "localhost:3002"
