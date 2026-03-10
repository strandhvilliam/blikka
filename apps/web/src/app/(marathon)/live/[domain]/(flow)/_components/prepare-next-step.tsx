"use client";

import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, NotebookPen, UserRoundCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { formatDomainPathname } from "@/lib/utils";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { useStepState } from "../_lib/step-state-context";
import type { CompetitionClass, DeviceGroup } from "@blikka/db";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PrepareNextStepProps {
  competitionClass: CompetitionClass;
  deviceGroup: DeviceGroup;
}

export function PrepareNextStep({
  competitionClass,
  deviceGroup,
}: PrepareNextStepProps) {
  const t = useTranslations("FlowPage.prepareStep");
  const commonT = useTranslations("FlowPage.uploadStep");
  const trpc = useTRPC();
  const domain = useDomain();
  const router = useRouter();
  const { handlePrevStep } = useStepState();
  const { uploadFlowState } = useUploadFlowState();
  const [isPrepared, setIsPrepared] = useState(false);

  const { mutateAsync: prepareUploadFlow, isPending } = useMutation(
    trpc.uploadFlow.prepareUploadFlow.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t("saveFailed"));
      },
    }),
  );

  const handlePrepare = async () => {
    if (
      !uploadFlowState.participantRef ||
      !uploadFlowState.participantFirstName ||
      !uploadFlowState.participantLastName ||
      !uploadFlowState.participantEmail ||
      !uploadFlowState.competitionClassId ||
      !uploadFlowState.deviceGroupId
    ) {
      toast.error(commonT("missingRequiredInfo"));
      return;
    }

    try {
      await prepareUploadFlow({
        domain,
        reference: uploadFlowState.participantRef,
        firstname: uploadFlowState.participantFirstName,
        lastname: uploadFlowState.participantLastName,
        email: uploadFlowState.participantEmail,
        competitionClassId: uploadFlowState.competitionClassId,
        deviceGroupId: uploadFlowState.deviceGroupId,
        phoneNumber: uploadFlowState.participantPhone,
      });

      setIsPrepared(true);
    } catch {
      return;
    }
  };

  const handleStartOver = () => {
    router.replace(formatDomainPathname("/live", domain, "live"));
  };

  return (
    <div className="max-w-3xl mx-auto min-h-[70dvh] flex flex-col justify-center">
      <Card className="border-border/80 shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            {isPrepared ? (
              <UserRoundCheck className="size-7" />
            ) : (
              <NotebookPen className="size-7" />
            )}
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-rocgrotesk font-bold">
              {isPrepared ? t("readyTitle") : t("reviewTitle")}
            </CardTitle>
            <CardDescription className="text-base">
              {isPrepared ? t("readyDescription") : t("reviewDescription")}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
              {t("participantNumberLabel")}
            </p>
            <p className="mt-3 font-mono text-5xl font-bold tracking-[0.3em] text-slate-950">
              {uploadFlowState.participantRef}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard label={t("participantLabel")}>
              {uploadFlowState.participantFirstName}{" "}
              {uploadFlowState.participantLastName}
            </InfoCard>
            <InfoCard label={t("emailLabel")}>
              {uploadFlowState.participantEmail}
            </InfoCard>
            <InfoCard label={t("classLabel")}>{competitionClass.name}</InfoCard>
            <InfoCard label={t("deviceLabel")}>{deviceGroup.name}</InfoCard>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <Badge className="border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100">
                {t("nextBadge")}
              </Badge>
              <span>{t("nextTitle")}</span>
            </div>
            <p>{t("nextBody")}</p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {isPrepared ? (
            <PrimaryButton
              onClick={handleStartOver}
              className="w-full py-3.5 text-base rounded-full"
            >
              {t("startOver")}
            </PrimaryButton>
          ) : (
            <>
              <PrimaryButton
                onClick={() => void handlePrepare()}
                disabled={isPending}
                className="w-full py-3.5 text-base rounded-full"
              >
                {isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  t("confirm")
                )}
              </PrimaryButton>
              <Button
                variant="ghost"
                size="lg"
                onClick={handlePrevStep}
                disabled={isPending}
                className="w-full sm:w-[220px]"
              >
                {t("back")}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function InfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4 text-left">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-foreground">{children}</p>
    </div>
  );
}
