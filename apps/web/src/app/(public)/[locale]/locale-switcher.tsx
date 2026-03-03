"use client"

import { PublicNavigation } from "@/i18n/navigation.public"
import { useLocale } from "next-intl"
import { LOCALES } from "@/config"

export const LocaleSwitcher = () => {
  const currentLocale = useLocale()
  const pathname = PublicNavigation.usePathname()
  return (
    <>
      {LOCALES.map((locale) => (
        <PublicNavigation.Link key={locale} locale={locale} href={pathname}>
          {locale === currentLocale ? <span className="font-bold">{locale}</span> : locale}
        </PublicNavigation.Link>
      ))}
    </>
  )
}
