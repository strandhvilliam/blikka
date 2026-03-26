"use client"

import { PublicNavigation } from "@/i18n/navigation.public"
import { LOCALES } from "@/config"
import { useLocale, type Locale } from "next-intl"
import { cn } from "@/lib/utils"

const localeLabel = (locale: Locale) => (locale === "sv" ? "SV" : "EN")

export type PublicLocaleSwitcherVariant = "floating" | "navbarDark" | "navbarMobile"

type PublicLocaleSwitcherProps = {
  variant: PublicLocaleSwitcherVariant
  className?: string
}

export function PublicLocaleSwitcher({ variant, className }: PublicLocaleSwitcherProps) {
  const currentLocale = useLocale() as Locale
  const pathname = PublicNavigation.usePathname()

  const shellClass =
    variant === "floating"
      ? "rounded-full border border-border/90 bg-background/95 p-1 text-sm shadow-md backdrop-blur-md"
      : variant === "navbarDark"
        ? "rounded-full border border-white/25 bg-black/25 p-1 text-sm text-white backdrop-blur-md"
        : "rounded-full border border-black/10 bg-white/90 p-1 text-sm text-brand-black shadow-sm backdrop-blur-md"

  return (
    <div role="group" aria-label="Language" className={cn("inline-flex", shellClass, className)}>
      {LOCALES.map((locale) => {
        const active = locale === currentLocale
        return (
          <PublicNavigation.Link
            key={locale}
            href={pathname}
            locale={locale}
            aria-current={active ? "true" : undefined}
            className={cn(
              "min-w-[2.5rem] rounded-full px-3 py-1.5 text-center text-xs font-medium uppercase tracking-wide transition-colors",
              variant === "floating" &&
                (active
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"),
              variant === "navbarDark" &&
                (active ? "bg-white/25 text-white" : "text-white/75 hover:text-white"),
              variant === "navbarMobile" &&
                (active
                  ? "bg-brand-black text-white"
                  : "text-brand-black/70 hover:text-brand-black"),
            )}
          >
            {localeLabel(locale)}
          </PublicNavigation.Link>
        )
      })}
    </div>
  )
}

export function PublicLocaleSwitcherFloating() {
  const pathname = PublicNavigation.usePathname()
  if (pathname === "/") return null

  return (
    <div className="fixed top-4 right-4 z-[100] sm:top-5 sm:right-5 md:top-6 md:right-6">
      <PublicLocaleSwitcher variant="floating" />
    </div>
  )
}
