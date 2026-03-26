import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import type { Locale } from "next-intl"
import { DEFAULT_LOCALE, LOCALES, protocol, rootDomain } from "@/config"
import { TermsMarkdown } from "../[domain]/terms/_components/terms-markdown"
import { PlatformTermsHero } from "./_components/platform-terms-hero"

function termsMarkdownPath(locale: Locale) {
  const suffix = locale === "sv" ? "sv" : "en"
  return path.join(
    process.cwd(),
    "src",
    "app",
    "(public)",
    "[locale]",
    "terms-and-conditions",
    "_content",
    `blikka-terms-and-conditions.${suffix}.md`,
  )
}

function resolveLocale(candidate: string): Locale {
  return hasLocale(LOCALES, candidate) ? candidate : DEFAULT_LOCALE
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms-and-conditions">): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = resolveLocale(localeParam)
  const titles: Record<Locale, string> = {
    en: "Terms and conditions · Blikka",
    sv: "Villkor och regler · Blikka",
  }
  const descriptions: Record<Locale, string> = {
    en: "Participant terms for events arranged by Fotomaraton Sverige AB.",
    sv: "Deltagarvillkor för evenemang som arrangeras av Fotomaraton Sverige AB.",
  }

  const defaultUrl = `${protocol}://${rootDomain}/terms-and-conditions`
  const svUrl = `${protocol}://${rootDomain}/sv/terms-and-conditions`

  return {
    title: titles[locale],
    description: descriptions[locale],
    alternates: {
      canonical: `${protocol}://${rootDomain}${locale === DEFAULT_LOCALE ? "" : `/${locale}`}/terms-and-conditions`,
      languages: {
        en: defaultUrl,
        sv: svUrl,
        "x-default": defaultUrl,
      },
    },
  }
}

export default async function TermsAndConditionsPage({
  params,
}: PageProps<"/[locale]/terms-and-conditions">) {
  const { locale: localeParam } = await params
  const locale = resolveLocale(localeParam)
  const markdown = await readFile(termsMarkdownPath(locale), "utf8")

  return (
    <main className="mx-auto min-h-svh w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <PlatformTermsHero locale={locale} />

      <div className="pt-10">
        <TermsMarkdown markdown={markdown} />
      </div>
    </main>
  )
}
