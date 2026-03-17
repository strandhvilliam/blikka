"use client";

import { useState, useTransition } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useTranslations, useLocale, Locale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn, formatDomainPathname, formatPublicPathname } from "@/lib/utils";
import { format } from "date-fns";
import { enUS, sv } from "date-fns/locale";
import { Info, ImageIcon, Play } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import Image from "next/image";
import { changeLocaleAction } from "@/lib/actions/change-locale-action";
import { useRouter } from "next/navigation";
import { useDomain } from "@/lib/domain-provider";
import {
  getByCameraLiveAccessState,
  type ByCameraLiveAccessResult,
} from "@/lib/topics/by-camera-live-access-state";

const BUCKET_NAME = process.env.NEXT_PUBLIC_MARATHON_SETTINGS_BUCKET_NAME;

export function LiveClientPage() {
  const domain = useDomain();
  const trpc = useTRPC();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setLocale = (locale: Locale) => {
    startTransition(async () => {
      const response = await changeLocaleAction(locale);

      if (response.error) {
        console.error("Failed to change locale:", response.error);
        return;
      }

      router.refresh();
    });
  };

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  );

  const byCameraAccessState =
    marathon.mode === "by-camera" ? getByCameraLiveAccessState(marathon) : null;

  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleStartUpload = () => {
    if (termsAccepted) {
      switch (marathon.mode) {
        case "marathon":
          router.push(formatDomainPathname(`/live/marathon`, domain, "live"));
          break;
        case "by-camera":
          if (byCameraAccessState?.state !== "open") {
            return;
          }

          router.push(formatDomainPathname(`/live/by-camera`, domain, "live"));
          break;
      }
    }
  };

  const handleStartPrepare = () => {
    if (!termsAccepted || marathon.mode !== "marathon") {
      return;
    }

    router.push(formatDomainPathname(`/live/marathon/prepare`, domain, "live"));
  };

  const sponsorImages = marathon.sponsors
    ?.filter((s) => s.type.startsWith("live-initial"))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  return (
    <div className="flex flex-col min-h-dvh relative overflow-hidden pt-4">
      <div className="z-20 flex flex-col flex-1 h-full">
        <main className="flex-1 px-6 pb-6 max-w-md mx-auto w-full flex flex-col justify-end">
          <LogoAndEventInfo marathon={marathon} />

          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 border border-border shadow-xl">
            <LanguageSelection
              locale={locale}
              setLocale={setLocale}
              isPending={isPending}
            />

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

            <SponsorsSection sponsorImages={sponsorImages} />
          </div>

          <PoweredByBlikka />
        </main>
      </div>
    </div>
  );
}

function LogoAndEventInfo({
  marathon,
}: {
  marathon: {
    logoUrl: string | null;
    name: string;
    startDate: string | null;
    endDate: string | null;
  };
}) {
  const t = useTranslations("LivePage");
  return (
    <div className="flex flex-col items-center pb-12">
      {marathon.logoUrl ? (
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3 overflow-hidden shadow border">
          <img src={marathon.logoUrl} alt="Logo" width={96} height={96} />
        </div>
      ) : (
        <div className="w-24 h-24 rounded-full flex items-center justify-center bg-gray-200">
          <ImageIcon className="w-12 h-12" />
        </div>
      )}
      <h1 className="text-2xl font-rocgrotesk font-extrabold text-gray-900 text-center mt-2">
        {marathon.name}
      </h1>
      <p className="text-center text-lg mt-1 font-medium tracking-wide">
        {marathon.startDate && marathon.endDate ? (
          <>
            {format(new Date(marathon.startDate), "dd MMMM yyyy")} -{" "}
            {format(new Date(marathon.endDate), "dd MMMM yyyy")}
          </>
        ) : (
          t("datesToBeAnnounced")
        )}
      </p>
    </div>
  );
}

function LanguageSelection({
  locale,
  setLocale,
  isPending,
}: {
  locale: string;
  setLocale: (locale: Locale) => void;
  isPending: boolean;
}) {
  const t = useTranslations("LivePage");
  return (
    <section className="mb-5">
      <label className="block text-sm font-medium mb-2">
        {t("selectLanguage")}
      </label>
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-4 border-2",
            locale === "en" && "border-foreground",
          )}
          onClick={() => setLocale("en")}
          disabled={isPending}
        >
          <ReactCountryFlag countryCode="GB" svg />
          English
        </Button>
        <Button
          variant="outline"
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-4 border-2",
            locale === "sv" && "border-foreground",
          )}
          onClick={() => setLocale("sv")}
          disabled={isPending}
        >
          <ReactCountryFlag countryCode="SE" svg />
          Svenska
        </Button>
      </div>
    </section>
  );
}

function RulesAndInformation({ description }: { description: string | null }) {
  const t = useTranslations("LivePage");
  if (!description) return null;

  return (
    <section className="mb-5">
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex gap-2 py-4 justify-start underline underline-offset-1"
          >
            <Info size={16} />
            {t("rulesAndInformation")}t
          </Button>
          t
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info size={20} />
              {t("rulesAndInformation")}t
            </DialogTitle>
            t
          </DialogHeader>
          <div className="prose prose-sm max-w-none">{description}</div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

const dateFnsLocales = { en: enUS, sv } as const;

function StartButtons({
  marathonMode,
  onUploadClick,
  onPrepareClick,
  disabled,
  byCameraAccessState,
  activeTopic,
}: {
  marathonMode: "marathon" | "by-camera";
  onUploadClick: () => void;
  onPrepareClick: () => void;
  disabled: boolean;
  byCameraAccessState?: ByCameraLiveAccessResult | null;
  activeTopic?: {
    scheduledStart: string | null;
  } | null;
}) {
  const t = useTranslations("LivePage");
  const locale = useLocale();
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
    );
  }

  if (byCameraAccessState?.state !== "open") {
    let message = t("submissionsUnavailable");

    if (
      byCameraAccessState?.state === "scheduled" &&
      activeTopic?.scheduledStart
    ) {
      message = t("submissionsScheduled", {
        date: format(new Date(activeTopic.scheduledStart), "PPp", {
          locale: dateFnsLocales[locale] ?? enUS,
        }),
      });
    } else if (byCameraAccessState?.reason === "missing-scheduled-start") {
      message = t("submissionsNotOpenYet");
    } else if (byCameraAccessState?.state === "closed") {
      message = t("submissionsClosed");
    }

    return (
      <p className="text-center text-muted-foreground py-4 px-2">{message}</p>
    );
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
  );
}

function TermsCheckbox({
  termsAccepted,
  setTermsAccepted,
  domain,
  locale,
}: {
  termsAccepted: boolean;
  setTermsAccepted: (value: boolean) => void;
  domain: string;
  locale: string;
}) {
  const t = useTranslations("LivePage");
  return (
    <section className="mb-6 space-y-4">
      <label htmlFor="platform-terms" className="text-sm font-medium">
        <div className="flex items-center space-x-2 px-2.5 border rounded-lg py-2 bg-background">
          <Checkbox
            id="platform-terms"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
          />
          {t("termsAccept")}{" "}
          <a
            target="_blank"
            href={formatPublicPathname(`/terms`, domain, locale)}
            className="underline font-semibold ml-1"
          >
            {t("termsAndConditions")}
          </a>
        </div>
      </label>
    </section>
  );
}

function SponsorsSection({
  sponsorImages,
}: {
  sponsorImages:
    | { id: number; key: string; type: string; createdAt: string }[]
    | undefined;
}) {
  const t = useTranslations("LivePage");
  if (!sponsorImages || sponsorImages.length === 0) return null;

  return (
    <div className="mt-4 pt-6 border-t border-gray-200">
      <p className="text-center text-sm text-muted-foreground mb-2">
        {t("sponsors")}
      </p>
      <div className="flex justify-center items-center gap-4 flex-wrap">
        {sponsorImages.map((sponsor) => (
          <div
            key={sponsor.id}
            className="h-10 flex items-center justify-center"
          >
            <img
              src={`https://s3.eu-north-1.amazonaws.com/${BUCKET_NAME}/${sponsor.key}`}
              alt="Sponsor"
              className="max-h-10 max-w-[120px] object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PoweredByBlikka() {
  return (
    <div className="mt-6 flex flex-col items-center">
      <p className="text-xs text-muted-foreground mb-1 italic">Powered by</p>
      <div className="flex items-center gap-1.5">
        <Image src="/blikka-logo.svg" alt="Blikka" width={20} height={17} />
        <span className="font-rocgrotesk font-bold text-base tracking-tight">
          blikka
        </span>
      </div>
    </div>
  );
}
