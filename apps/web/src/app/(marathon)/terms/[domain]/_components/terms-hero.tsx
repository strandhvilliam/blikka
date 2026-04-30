import { ArrowLeft } from "lucide-react"
import { BLIKKA_PLATFORM_TERMS_URL } from "@/config"
import { formatDomainLink } from "@/lib/utils"

type TermsHeroProps = {
  domain: string
  marathonName: string
  logoUrl: string | null | undefined
}

export function TermsHero({ domain, marathonName, logoUrl }: TermsHeroProps) {
  const eventHomeHref = formatDomainLink("/", domain, "live")

  return (
    <header className="border-b border-border pb-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <a
          href={eventHomeHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Event home
        </a>
        <a
          href={BLIKKA_PLATFORM_TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-right text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Blikka system terms
        </a>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-lg font-semibold text-muted-foreground">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external S3 marathon logos; no stable remotePatterns
            <img src={logoUrl} alt={`${marathonName} logo`} className="h-full w-full object-cover" />
          ) : (
            <span className="font-rocgrotesk font-bold text-foreground/70" aria-hidden="true">
              {marathonName.slice(0, 1)}
            </span>
          )}
        </div>
        <h1 className="min-w-0 text-center font-rocgrotesk text-2xl font-bold tracking-tight text-foreground sm:text-left sm:text-3xl">
          {marathonName}
        </h1>
      </div>
    </header>
  )
}
