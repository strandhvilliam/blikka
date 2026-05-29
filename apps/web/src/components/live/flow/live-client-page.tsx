'use client'

import { useState, useTransition } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { useTranslations, useLocale, Locale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LiveParticipationStart } from '@/components/live/flow/live-participation-start'
import {
  buildS3Url,
  cn,
  formatDomainLink,
  formatDomainPathname,
  formatPlatformTermsPathname,
} from '@/lib/utils'
import { format } from 'date-fns'
import { Info, ImageIcon } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import Image from 'next/image'
import { changeLocaleAction } from '@/lib/actions/change-locale-action'
import { useRouter } from 'next/navigation'
import { useDomain } from '@/lib/domain-provider'
import { getByCameraLiveAccessState } from '@/lib/by-camera/by-camera-live-access-state'
import { resolveLiveLandingSponsor } from '@/lib/sponsors/live-landing-sponsor'

const LIVE_LANGUAGE_OPTIONS = [
  { locale: 'en' as const, countryCode: 'GB', label: 'EN' },
  { locale: 'sv' as const, countryCode: 'SE', label: 'SV' },
] as const

export function LiveClientPage() {
  const domain = useDomain()
  const trpc = useTRPC()
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const setLocale = (locale: Locale) => {
    startTransition(async () => {
      const response = await changeLocaleAction(locale)

      if (response.error) {
        console.error('Failed to change locale:', response.error)
        return
      }

      router.refresh()
    })
  }

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  )

  const marathonMode = marathon.mode as 'marathon' | 'by-camera'
  const byCameraAccessState =
    marathonMode === 'by-camera' ? getByCameraLiveAccessState(marathon) : null

  const [termsAccepted, setTermsAccepted] = useState(false)

  const withTermsAcceptanceParams = (pathname: string) => {
    const params = new URLSearchParams({
      ta: 'true',
      tl: locale,
    })
    return `${pathname}?${params.toString()}`
  }

  const handleStartUpload = () => {
    if (!termsAccepted) return

    if (marathonMode === 'marathon') {
      router.push(formatDomainPathname(withTermsAcceptanceParams(`/live/marathon`), domain, 'live'))
      return
    }

    if (byCameraAccessState?.state !== 'open') return

    router.push(formatDomainPathname(withTermsAcceptanceParams(`/live/by-camera`), domain, 'live'))
  }

  const handleStartPrepare = () => {
    if (!termsAccepted || marathonMode !== 'marathon') return

    router.push(
      formatDomainPathname(withTermsAcceptanceParams(`/live/marathon/prepare`), domain, 'live'),
    )
  }

  const landingSponsor = resolveLiveLandingSponsor(marathon.sponsors)

  return (
    <div className="flex flex-col min-h-dvh relative overflow-hidden pt-4">
      <BlikkaTopLogo />
      <LanguageToggle locale={locale} setLocale={setLocale} isPending={isPending} />
      <div className="z-20 flex flex-col flex-1 h-full">
        <main className="flex-1 w-full flex flex-col justify-center pt-5 pb-4 sm:pb-6">
          <div className="px-3 sm:px-6 max-w-md mx-auto w-full">
            <LogoAndEventInfo
              marathon={marathon}
              mode={marathonMode}
              activeTopicName={
                marathonMode === 'by-camera'
                  ? (byCameraAccessState?.activeTopic?.name ?? null)
                  : null
              }
            />

            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] space-y-4">
              <RulesAndInformation description={marathon.description} />

              <TermsCheckbox
                termsAccepted={termsAccepted}
                setTermsAccepted={setTermsAccepted}
                domain={domain}
                locale={locale}
              />

              <LiveParticipationStart
                marathonMode={marathonMode}
                onUploadClick={handleStartUpload}
                onPrepareClick={handleStartPrepare}
                disabled={!termsAccepted}
                byCameraAccessState={byCameraAccessState}
                activeTopic={byCameraAccessState?.activeTopic ?? null}
              />

              <OfficialBrowserTip />
            </div>
          </div>

          <SponsorsSection sponsor={landingSponsor} />
        </main>
      </div>
    </div>
  )
}

function LogoAndEventInfo({
  marathon,
  mode,
  activeTopicName,
}: {
  marathon: {
    logoUrl: string | null
    name: string
    startDate: string | null
    endDate: string | null
  }
  mode: 'marathon' | 'by-camera'
  activeTopicName: string | null
}) {
  const t = useTranslations('LivePage')

  let subtitle: string
  if (mode === 'by-camera') {
    subtitle = activeTopicName ?? t('noTopicOpen')
  } else if (marathon.startDate && marathon.endDate) {
    subtitle = `${format(new Date(marathon.startDate), 'dd MMMM yyyy')} - ${format(new Date(marathon.endDate), 'dd MMMM yyyy')}`
  } else {
    subtitle = t('datesToBeAnnounced')
  }

  return (
    <div className="flex flex-col items-center pb-5 sm:pb-6">
      {marathon.logoUrl ? (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mb-3 overflow-hidden shadow border">
          <img
            src={marathon.logoUrl}
            alt="Logo"
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center bg-gray-200">
          <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
      )}
      <h1 className="text-xl sm:text-2xl font-gothic font-medium text-foreground text-center mt-1 tracking-tight">
        {marathon.name}
      </h1>
      <p className="text-center text-sm sm:text-base mt-1 font-medium tracking-wide text-muted-foreground">
        {subtitle}
      </p>
    </div>
  )
}

function LanguageToggle({
  locale,
  setLocale,
  isPending,
}: {
  locale: string
  setLocale: (locale: Locale) => void
  isPending: boolean
}) {
  const t = useTranslations('LivePage')
  return (
    <div
      className="absolute right-3 top-3 z-30 sm:right-5 sm:top-5"
      role="group"
      aria-label={t('selectLanguage')}
    >
      <div
        className={cn(
          'flex items-center gap-0.5 rounded-full border border-border bg-white/90 p-1 shadow-sm backdrop-blur-sm transition-opacity',
          isPending && 'opacity-60',
        )}
      >
        {LIVE_LANGUAGE_OPTIONS.map((option) => (
          <button
            key={option.locale}
            type="button"
            aria-pressed={option.locale === locale}
            aria-busy={isPending}
            disabled={isPending || option.locale === locale}
            onClick={() => setLocale(option.locale)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors',
              option.locale === locale
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-accent/60',
            )}
          >
            <ReactCountryFlag
              countryCode={option.countryCode}
              svg
              style={{ width: '1em', height: '1em' }}
            />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RulesAndInformation({ description }: { description: string | null }) {
  const t = useTranslations('LivePage')
  if (!description) return null

  return (
    <section>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex gap-2 py-4 justify-start underline underline-offset-1"
          >
            <Info size={16} />
            {t('rulesAndInformation')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info size={20} />
              {t('rulesAndInformation')}
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">{description}</div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function OfficialBrowserTip() {
  const t = useTranslations('LivePage')
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 px-3.5 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('officialBrowserTip')}{' '}
        <span className="text-muted-foreground/80">{t('minimumDeviceTip')}</span>
      </p>
    </div>
  )
}

function TermsCheckbox({
  termsAccepted,
  setTermsAccepted,
  domain,
  locale,
}: {
  termsAccepted: boolean
  setTermsAccepted: (value: boolean) => void
  domain: string
  locale: string
}) {
  const t = useTranslations('LivePage')

  const ariaLabel = `${t('termsAccept')} ${t('organizerTerms')} ${t('termsAcceptAnd')} ${t('blikkaTerms')}`

  function handleRowClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('a')) return
    setTermsAccepted(!termsAccepted)
  }

  return (
    <section>
      <div
        onClick={handleRowClick}
        className={cn(
          'flex items-start gap-3 px-4 py-4 rounded-xl border border-input bg-muted/30 cursor-pointer select-none',
          'min-h-[60px] transition-colors hover:bg-muted/50 active:bg-muted/60',
        )}
      >
        <Checkbox
          id="platform-terms"
          aria-label={ariaLabel}
          className="size-6 mt-0.5 shrink-0 rounded-md border-foreground/25 pointer-events-none"
          checked={termsAccepted}
        />
        <span className="text-sm font-medium text-pretty leading-snug">
          {t('termsAccept')}{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={formatDomainLink('/terms', domain, 'terms')}
            className="underline font-semibold"
            onClick={(event) => event.stopPropagation()}
          >
            {t('organizerTerms')}
          </a>{' '}
          {t('termsAcceptAnd')}{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={formatPlatformTermsPathname(locale)}
            className="underline font-semibold"
            onClick={(event) => event.stopPropagation()}
          >
            {t('blikkaTerms')}
          </a>
        </span>
      </div>
    </section>
  )
}

function SponsorsSection({ sponsor }: { sponsor: { id: number; key: string } | undefined }) {
  const t = useTranslations('LivePage')
  const [failed, setFailed] = useState(false)
  const imageUrl = buildS3Url(process.env.NEXT_PUBLIC_SPONSORS_BUCKET_NAME, sponsor?.key)
  if (!sponsor || !imageUrl || failed) return null

  return (
    <div className="mt-5 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-6 flex flex-col items-center">
      <p className="text-center text-sm font-medium text-muted-foreground mb-3 sm:mb-4">
        {t('sponsors')}
      </p>
      <div className="w-full flex justify-center">
        <img
          src={imageUrl}
          alt={t('sponsors')}
          onError={() => setFailed(true)}
          className="h-auto w-auto max-w-full max-h-48 sm:max-h-64 object-contain rounded-xl border border-border/35 bg-white/80 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.05)]"
        />
      </div>
    </div>
  )
}

function BlikkaTopLogo() {
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-1 sm:left-6 sm:top-5">
      <p className="sr-only">Blikka</p>
      <Image src="/blikka-logo.svg" alt="" width={18} height={15} aria-hidden />
      <span className="font-special-gothic text-sm tracking-tight text-foreground/90" aria-hidden>
        blikka
      </span>
    </div>
  )
}
