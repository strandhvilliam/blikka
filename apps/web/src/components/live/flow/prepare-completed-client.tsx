"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Hash,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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
    <div className="min-h-dvh px-4 py-6 sm:px-6 sm:py-10 max-w-md mx-auto flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.5 }}
        className="text-center pt-8"
      >
        <div className="relative inline-block">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
            className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center shadow-xl shadow-green-500/30"
          >
            <CheckCircle2 className="h-16 w-16 text-white" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 space-y-2"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h1 className="text-3xl font-rocgrotesk font-bold text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6"
      >
        <Card className="bg-green-50/60 border-green-200 dark:bg-green-950/20 dark:border-green-800 overflow-hidden">
          <CardContent className="p-4 space-y-4">
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-widest text-green-700 dark:text-green-300">
                {t("participantNumberLabel")}
              </p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-green-700 dark:text-green-300">
                {params.participantRef}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("participantNumberHelp")}
              </p>
            </div>

            <div className="grid gap-3">
              <InfoRow
                icon={<Users className="h-4 w-4" />}
                label={t("participantLabel")}
                value={participantName}
              />
              <InfoRow
                icon={<Mail className="h-4 w-4" />}
                label={t("emailLabel")}
                value={params.participantEmail}
              />
              <InfoRow
                icon={<Hash className="h-4 w-4" />}
                label={t("statusLabel")}
                value={t("statusValue")}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-4"
      >
        <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="shrink-0 w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h2 className="font-rocgrotesk font-bold text-foreground">
                  {t("nextStepsTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("nextStepsDescription")}
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <StepRow index={1} title={t("stepOneTitle")} body={t("stepOneBody")} />
              <StepRow index={2} title={t("stepTwoTitle")} body={t("stepTwoBody")} />
              <StepRow
                index={3}
                title={t("stepThreeTitle")}
                body={t("stepThreeBody")}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex flex-col gap-3 mt-8"
      >
        <PrimaryButton
          onClick={() =>
            router.replace(
              formatDomainPathname("/live/marathon/prepare", domain, "live"),
            )
          }
          className="w-full py-3.5 text-base rounded-full"
        >
          <span>{t("prepareAnother")}</span>
          <ArrowRight className="ml-2 h-5 w-5" />
        </PrimaryButton>
      </motion.div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StepRow({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
          {index}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
