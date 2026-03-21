"use client"

import { useLocale } from "next-intl"
import { LOCALES } from "@/config"
import { updateLocaleAction } from "../actions"
import { useTransition } from "react"
import ReactCountryFlag from "react-country-flag"
import { cn } from "@/lib/utils"

const localeConfig: Record<string, { label: string; countryCode: string }> = {
  en: { label: "English", countryCode: "GB" },
  sv: { label: "Svenska", countryCode: "SE" },
}

export function LanguageSwitcher() {
  const currentLocale = useLocale()
  const [isPending, startTransition] = useTransition()

  const handleLocaleChange = (locale: string) => {
    if (locale === currentLocale || isPending) return

    startTransition(() => {
      updateLocaleAction({ locale })
    })
  }

  return (
    <div className="flex items-center gap-1">
      {LOCALES.map((locale) => {
        const config = localeConfig[locale]
        if (!config) return null

        const isActive = locale === currentLocale

        return (
          <button
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            disabled={isPending}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              isActive
                ? "border border-brand-black/12 bg-white text-brand-black shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                : "text-brand-black/40 hover:text-brand-black/70",
              isPending && "opacity-50 pointer-events-none",
            )}
            aria-label={`Switch to ${config.label}`}
          >
            <ReactCountryFlag
              countryCode={config.countryCode}
              svg
              style={{ width: "1em", height: "1em" }}
            />
            <span className="uppercase tracking-wide">{locale}</span>
          </button>
        )
      })}
    </div>
  )
}
