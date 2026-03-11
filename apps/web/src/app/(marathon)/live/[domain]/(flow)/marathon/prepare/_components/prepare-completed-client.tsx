"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Hash,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { formatDomainPathname } from "@/lib/utils";

interface PrepareCompletedClientProps {
  domain: string;
  params: {
    participantRef: string;
    participantFirstName: string;
    participantLastName: string;
    participantEmail: string;
  };
}

export function PrepareCompletedClient({
  domain,
  params,
}: PrepareCompletedClientProps) {
  const t = useTranslations("FlowPage.prepareCompleted");
  const router = useRouter();

  const participantName =
    `${params.participantFirstName} ${params.participantLastName}`.trim() ||
    t("fallbackParticipant");

  return (
    <div className="min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(187,247,208,0.35),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(248,250,252,1)_100%)] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-3xl flex-col justify-center">
        <div className="relative overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-white/90 shadow-[0_32px_120px_-36px_rgba(22,163,74,0.35)] backdrop-blur">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent" />
          <div className="absolute -right-20 top-8 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-lime-100/80 blur-3xl" />

          <div className="relative space-y-8 p-6 sm:p-10">
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 shadow-sm">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-700">
                  {t("eyebrow")}
                </p>
                <h1 className="font-rocgrotesk text-3xl font-bold text-slate-950 sm:text-4xl">
                  {t("title")}
                </h1>
                <p className="mx-auto max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                  {t("description")}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.75rem] border border-slate-200/80 bg-slate-950 px-6 py-6 text-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.8)]">
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-emerald-300/90">
                  {t("participantNumberLabel")}
                </p>
                <p className="mt-4 font-mono text-5xl font-bold tracking-[0.34em] text-white sm:text-6xl">
                  {params.participantRef}
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {t("participantNumberHelp")}
                </p>
              </div>

              <div className="grid gap-3">
                <InfoCard
                  icon={<Users className="h-4 w-4 text-emerald-700" />}
                  label={t("participantLabel")}
                  value={participantName}
                />
                <InfoCard
                  icon={<Mail className="h-4 w-4 text-emerald-700" />}
                  label={t("emailLabel")}
                  value={params.participantEmail}
                />
                <InfoCard
                  icon={<Hash className="h-4 w-4 text-emerald-700" />}
                  label={t("statusLabel")}
                  value={t("statusValue")}
                />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-emerald-200/80 bg-emerald-50/70 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-rocgrotesk text-xl font-bold text-slate-950">
                    {t("nextStepsTitle")}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {t("nextStepsDescription")}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <StepCard
                  index="01"
                  title={t("stepOneTitle")}
                  body={t("stepOneBody")}
                />
                <StepCard
                  index="02"
                  title={t("stepTwoTitle")}
                  body={t("stepTwoBody")}
                />
                <StepCard
                  index="03"
                  title={t("stepThreeTitle")}
                  body={t("stepThreeBody")}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <PrimaryButton
                onClick={() =>
                  router.replace(
                    formatDomainPathname(
                      "/live/marathon/prepare",
                      domain,
                      "live",
                    ),
                  )
                }
                className="w-full rounded-full py-3.5 text-base sm:w-auto sm:min-w-[260px]"
              >
                <span>{t("registerAnother")}</span>
                <ArrowRight className="ml-2 h-5 w-5" />
              </PrimaryButton>
              <Button
                variant="ghost"
                onClick={() =>
                  router.replace(formatDomainPathname("/live", domain, "live"))
                }
                className="w-full rounded-full py-3.5 text-base sm:w-auto sm:min-w-[220px]"
              >
                {t("backToLive")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/85 px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StepCard({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
        {index}
      </p>
      <h3 className="mt-3 font-rocgrotesk text-lg font-bold text-slate-950">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
