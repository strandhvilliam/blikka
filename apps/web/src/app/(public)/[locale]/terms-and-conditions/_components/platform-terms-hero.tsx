import { ArrowLeft } from "lucide-react"
import type { Locale } from "next-intl"
import { PublicNavigation } from "@/i18n/navigation.public"

type PlatformTermsHeroProps = {
  locale: Locale
}

export function PlatformTermsHero({ locale }: PlatformTermsHeroProps) {
  const copy =
    locale === "sv"
      ? {
          back: "Tillbaka till blikka",
          subtitle: "Deltagarvillkor — Fotomaraton Sverige AB (559209-9732).",
        }
      : {
          back: "Back to blikka",
          subtitle: "Participant terms — Fotomaraton Sverige AB (559209-9732).",
        }

  return (
    <header className="border-b border-border pb-8">
      <div className="mb-6">
        <PublicNavigation.Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {copy.back}
        </PublicNavigation.Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- static marketing asset */}
          <img src="/blikka-logo-dark.svg" alt="blikka" width={36} height={30} className="h-8 w-auto" />
        </div>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>
    </header>
  )
}
