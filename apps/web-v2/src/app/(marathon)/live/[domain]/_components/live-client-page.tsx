"use client";

import { useState, useTransition } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useTranslations, useLocale, Locale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PrimaryButton } from "@/components/ui/primary-button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Info, ImageIcon, Play } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import Image from "next/image";
import { changeLocaleAction } from "@/lib/actions/change-locale-action";
import { useRouter } from "next/navigation";
import { useDomain } from "@/lib/domain-provider";


export function LiveClientPage() {
  const domain = useDomain();
  const trpc = useTRPC();
  const t = useTranslations("LivePage");
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

  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleStart = () => {
    if (termsAccepted) {
      window.location.href = `/live/${domain}/upload`;
    }
  };

  const sponsorImages = marathon.sponsors
    ?.filter((s) => s.type === "participant-initial")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const bucketName =
    process.env.NEXT_PUBLIC_MARATHON_SETTINGS_BUCKET_NAME ||
    "marathon-settings-bucket";

  return (
    <div className="flex flex-col min-h-dvh relative overflow-hidden">
      <div className="z-20 flex flex-col flex-1 h-full">

        <main className="flex-1 px-6 pb-6 max-w-md mx-auto w-full flex flex-col justify-end">
          {/* Logo and event info */}
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
            <h1 className="text-3xl font-rocgrotesk font-extrabold text-gray-900 text-center mt-2">
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

          {/* Main card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 border border-border shadow-xl">
            <h2 className="text-2xl font-rocgrotesk font-semibold mb-4">
              {t("gettingStarted")}
            </h2>

            {/* Language selection */}
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

            {/* Rules and Information */}
            {marathon.description && (
              <section className="mb-5">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="rules" className="border-gray-200">
                    <AccordionTrigger
                      className="font-semibold text-sm py-3"
                      onClick={() => {
                        setTimeout(() => {
                          window.scrollTo({
                            top: document.documentElement.scrollHeight,
                            behavior: "smooth",
                          });
                        }, 150);
                      }}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <Info size={16} />
                        {t("rulesAndInformation")}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm font-medium space-y-2">
                      <div className="prose prose-sm max-w-none">
                        {marathon.description}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </section>
            )}

            {/* Terms checkbox */}
            <section className="mb-6 space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="platform-terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) =>
                    setTermsAccepted(checked as boolean)
                  }
                  className="mt-1"
                />
                <label htmlFor="platform-terms" className="text-sm font-medium">
                  {t("termsAccept")}{" "}
                  <button className="underline font-semibold">
                    {t("termsAndConditions")}
                  </button>
                </label>
              </div>
            </section>

            {/* Start button */}
            <PrimaryButton
              onClick={handleStart}
              disabled={!termsAccepted}
              className="w-full py-3 text-base text-white rounded-full"
            >
              {t("begin")}
              <Play className="h-4 w-4" />
            </PrimaryButton>

            {/* Sponsors section */}
            {sponsorImages && sponsorImages.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-center text-sm text-muted-foreground mb-4">
                  {t("sponsors")}
                </p>
                <div className="flex justify-center items-center gap-4 flex-wrap">
                  {sponsorImages.map((sponsor) => (
                    <div
                      key={sponsor.id}
                      className="h-10 flex items-center justify-center"
                    >
                      <img
                        src={`https://s3.eu-north-1.amazonaws.com/${bucketName}/${sponsor.key}`}
                        alt="Sponsor"
                        className="max-h-10 max-w-[120px] object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Powered by Blikka */}
          <div className="mt-6 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-1 italic">
              {t("poweredBy")}
            </p>
            <div className="flex items-center gap-1.5">
              <Image
                src="/blikka-logo.svg"
                alt="Blikka"
                width={20}
                height={17}
              />
              <span className="font-rocgrotesk font-bold text-base tracking-tight">
                blikka
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
