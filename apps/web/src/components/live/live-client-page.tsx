"use client"

import { useState, useTransition } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useTranslations, useLocale, Locale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PrimaryButton } from "@/components/ui/primary-button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  cn,
  formatDomainPathname,
  formatPlatformTermsPathname,
  formatPublicPathname,
} from "@/lib/utils"
import { format } from "date-fns"
import { enUS, sv, type Locale as DateFnsLocale } from "date-fns/locale"
import { Info, ImageIcon, Play } from "lucide-react"
import ReactCountryFlag from "react-country-flag"
import Image from "next/image"
import { changeLocaleAction } from "@/lib/actions/change-locale-action"
import { useRouter } from "next/navigation"
import { useDomain } from "@/lib/domain-provider"
import {
  getByCameraLiveAccessState,
  type ByCameraLiveAccessResult,
} from "@/lib/by-camera/by-camera-live-access-state"
import { resolveLiveLandingSponsor } from "@/lib/sponsors/live-landing-sponsor"

const BUCKET_NAME = process.env.NEXT_PUBLIC_MARATHON_SETTINGS_BUCKET_NAME

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
        console.error("Failed to change locale:", response.error)
        return
      }

      router.refresh()
    })
  }

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  )

  const byCameraAccessState =
    marathon.mode === "by-camera" ? getByCameraLiveAccessState(marathon) : null

  const [termsAccepted, setTermsAccepted] = useState(false)

  const handleStartUpload = () => {
    if (termsAccepted) {
      switch (marathon.mode) {
        case "marathon":
          router.push(formatDomainPathname(`/live/marathon`, domain, "live"))
          break
        case "by-camera":
          if (byCameraAccessState?.state !== "open") {
            return
          }

          router.push(formatDomainPathname(`/live/by-camera`, domain, "live"))
          break
      }
    }
  }

  const handleStartPrepare = () => {
    if (!termsAccepted || marathon.mode !== "marathon") {
      return
    }

    router.push(formatDomainPathname(`/live/marathon/prepare`, domain, "live"))
  }

  const landingSponsor = resolveLiveLandingSponsor(marathon.sponsors)

  return (
    <div className="flex flex-col min-h-dvh relative overflow-hidden pt-4">
      <PoweredByBlikka />
      <div className="z-20 flex flex-col flex-1 h-full">
        <main className="flex-1 w-full flex flex-col justify-center pb-4 sm:pb-6">
          <div className="px-3 sm:px-6 max-w-md mx-auto w-full">
            <LogoAndEventInfo
              marathon={marathon}
              mode={marathon.mode as "marathon" | "by-camera"}
              activeTopicName={
                marathon.mode === "by-camera"
                  ? (byCameraAccessState?.activeTopic?.name ?? null)
                  : null
              }
            />

            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
              <LanguageSelection locale={locale} setLocale={setLocale} isPending={isPending} />

              <RulesAndInformation description={marathon.description} />

              <TermsCheckbox
                termsAccepted={termsAccepted}
                setTermsAccepted={setTermsAccepted}
                domain={domain}
                locale={locale}
              />

              <StartButtons
                marathonMode={marathon.mode as "marathon" | "by-camera"}
                onUploadClick={handleStartUpload}
                onPrepareClick={handleStartPrepare}
                disabled={!termsAccepted}
                byCameraAccessState={byCameraAccessState}
                activeTopic={byCameraAccessState?.activeTopic ?? null}
              />
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
  mode: "marathon" | "by-camera"
  activeTopicName: string | null
}) {
  const t = useTranslations("LivePage")
  const subtitle =
    mode === "by-camera"
      ? (activeTopicName ?? t("datesToBeAnnounced"))
      : marathon.startDate && marathon.endDate
        ? `${format(new Date(marathon.startDate), "dd MMMM yyyy")} - ${format(new Date(marathon.endDate), "dd MMMM yyyy")}`
        : t("datesToBeAnnounced")

  return (
    <div className="flex flex-col items-center pb-8">
      {marathon.logoUrl ? (
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3 overflow-hidden shadow border">
          <img src={marathon.logoUrl} alt="Logo" width={96} height={96} />
        </div>
      ) : (
        <div className="w-24 h-24 rounded-full flex items-center justify-center bg-gray-200">
          <ImageIcon className="w-12 h-12" />
        </div>
      )}
      <h1 className="text-2xl font-gothic font-medium text-foreground text-center mt-2 tracking-tight">
        {marathon.name}
      </h1>
      <p className="text-center text-lg mt-1 font-medium tracking-wide">{subtitle}</p>
    </div>
  )
}

function LanguageSelection({
  locale,
  setLocale,
  isPending,
}: {
  locale: string
  setLocale: (locale: Locale) => void
  isPending: boolean
}) {
  const t = useTranslations("LivePage")
  return (
    <section className="mb-3 sm:mb-5">
      <p
        id="live-language-label"
        className="text-center text-sm font-medium text-muted-foreground mb-2 sm:mb-3"
      >
        {t("selectLanguage")}
      </p>
      <div className="flex gap-2 sm:gap-3" role="group" aria-labelledby="live-language-label">
        <Button
          type="button"
          variant="outline"
          aria-pressed={locale === "en"}
          className={cn(
            "min-w-0 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-colors",
            locale === "en"
              ? "border-primary bg-primary/5 font-medium shadow-xs"
              : "border-border hover:bg-accent/40",
          )}
          onClick={() => setLocale("en")}
          disabled={isPending}
        >
          <ReactCountryFlag countryCode="GB" svg />
          English
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-pressed={locale === "sv"}
          className={cn(
            "min-w-0 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-colors",
            locale === "sv"
              ? "border-primary bg-primary/5 font-medium shadow-xs"
              : "border-border hover:bg-accent/40",
          )}
          onClick={() => setLocale("sv")}
          disabled={isPending}
        >
          <ReactCountryFlag countryCode="SE" svg />
          Svenska
        </Button>
      </div>
    </section>
  )
}

function RulesAndInformation({ description }: { description: string | null }) {
  const t = useTranslations("LivePage")
  if (!description) return null

  return (
    <section className="mb-3 sm:mb-5">
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex gap-2 py-4 justify-start underline underline-offset-1"
          >
            <Info size={16} />
            {t("rulesAndInformation")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info size={20} />
              {t("rulesAndInformation")}
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">{description}</div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

const dateFnsLocales: Record<"en" | "sv", DateFnsLocale> = { en: enUS, sv }

function StartButtons({
  marathonMode,
  onUploadClick,
  onPrepareClick,
  disabled,
  byCameraAccessState,
  activeTopic,
}: {
  marathonMode: "marathon" | "by-camera"
  onUploadClick: () => void
  onPrepareClick: () => void
  disabled: boolean
  byCameraAccessState?: ByCameraLiveAccessResult | null
  activeTopic?: {
    scheduledStart: string | null
  } | null
}) {
  const t = useTranslations("LivePage")
  const locale = useLocale()
  if (marathonMode === "marathon") {
    return (
      <div className="flex flex-col gap-3">
        <PrimaryButton
          onClick={onUploadClick}
          disabled={disabled}
          className="w-full py-3 text-base text-white rounded-full"
        >
          {t("beginUpload")}
          <Play className="h-4 w-4" />
        </PrimaryButton>
        <Button
          variant="outline"
          onClick={onPrepareClick}
          disabled={disabled}
          className="w-full py-3 text-base rounded-full"
        >
          {t("prepareForLater")}
        </Button>
      </div>
    )
  }

  if (byCameraAccessState?.state !== "open") {
    let message = t("submissionsUnavailable")

    if (byCameraAccessState?.state === "scheduled" && activeTopic?.scheduledStart) {
      message = t("submissionsScheduled", {
        date: format(new Date(activeTopic.scheduledStart), "PPp", {
          locale: dateFnsLocales[locale as "en" | "sv"] ?? enUS,
        }),
      })
    } else if (byCameraAccessState?.reason === "missing-scheduled-start") {
      message = t("submissionsNotOpenYet")
    } else if (byCameraAccessState?.state === "closed") {
      message = t("submissionsClosed")
    }

    return <p className="text-center text-muted-foreground py-4 px-2">{message}</p>
  }

  return (
    <PrimaryButton
      onClick={onUploadClick}
      disabled={disabled}
      className="w-full py-3 text-base text-white rounded-full"
    >
      {t("begin")}
      <Play className="h-4 w-4" />
    </PrimaryButton>
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
  const t = useTranslations("LivePage")
  return (
    <section className="mb-4 sm:mb-6 space-y-4">
      <label htmlFor="platform-terms" className="text-sm font-medium">
        <div className="flex items-start gap-3 px-3 py-3 rounded-xl border border-input bg-muted/30">
          <Checkbox
            id="platform-terms"
            className="size-5 mt-0.5 rounded-[5px] border-foreground/20"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
          />
          <span className="text-pretty leading-snug">
            {t("termsAccept")}{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={formatPublicPathname(`/terms`, domain, locale)}
              className="underline font-semibold"
            >
              {t("organizerTerms")}
            </a>{" "}
            {t("termsAcceptAnd")}{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={formatPlatformTermsPathname(locale)}
              className="underline font-semibold"
            >
              {t("blikkaTerms")}
            </a>
          </span>
        </div>
      </label>
    </section>
  )
}

function SponsorsSection({ sponsor }: { sponsor: { id: number; key: string } | undefined }) {
  const t = useTranslations("LivePage")
  if (!sponsor) return null

  return (
    <div className="mt-5 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-6 flex flex-col items-center">
      <p className="text-center text-sm font-medium text-muted-foreground mb-3 sm:mb-4">{t("sponsors")}</p>
      <div className="w-full flex justify-center">
        <img
          src={`https://s3.eu-north-1.amazonaws.com/${BUCKET_NAME}/${sponsor.key}`}
          alt={t("sponsors")}
          className="w-full h-auto max-h-48 sm:max-h-64 object-contain rounded-xl border border-border/35 bg-white/80 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.05)]"
        />
      </div>
    </div>
  )
}

function PoweredByBlikka() {
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
