"use client"

import { useLocale } from "next-intl"
import { LOCALES } from "@/config"
import { updateLocaleAction } from "../actions"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTransition } from "react"
import { Languages } from "lucide-react"

const localeLabels: Record<string, string> = {
  en: "English",
  sv: "Svenska",
}

const localeFlags: Record<string, string> = {
  en: "🇬🇧",
  sv: "🇸🇪",
}

export function LanguageSwitcher() {
  const currentLocale = useLocale()
  const [isPending, startTransition] = useTransition()

  function handleLocaleChange(locale: string) {
    if (locale === currentLocale || isPending) return
    
    startTransition(() => {
      updateLocaleAction({ locale })
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
      <ToggleGroup
        type="single"
        value={currentLocale}
        onValueChange={(value) => {
          if (value) handleLocaleChange(value)
        }}
        variant="outline"
        className="gap-0 shadow-sm"
        disabled={isPending}
      >
        {LOCALES.map((locale) => (
          <ToggleGroupItem
            key={locale}
            value={locale}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all hover:bg-accent/50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            aria-label={`Switch to ${localeLabels[locale]}`}
            title={localeLabels[locale]}
          >
            <span className="text-base leading-none" aria-hidden="true">
              {localeFlags[locale]}
            </span>
            <span>{locale}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

