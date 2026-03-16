"use client"

import type { ReactNode } from "react"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { formatDomainPathname } from "@/lib/utils"
import { flowStateClientParamSerializer } from "@/lib/flow-state-params-client"
import { useUploadFlowState } from "../_hooks/use-upload-flow-state"
import { useStepState } from "../_lib/step-state-context"
import type { CompetitionClass, DeviceGroup } from "@blikka/db"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  buildPrepareCompletedSearchParamsResult,
  buildPrepareUploadFlowInputResult,
  getUploadFlowIssueMessageKeys,
} from "../_lib/upload-flow-state"

interface PrepareNextStepProps {
  competitionClass: CompetitionClass
  deviceGroup: DeviceGroup
}

export function PrepareNextStep({ competitionClass, deviceGroup }: PrepareNextStepProps) {
  const t = useTranslations("FlowPage.prepareStep")
  const commonT = useTranslations("FlowPage.uploadStep")
  const trpc = useTRPC()
  const domain = useDomain()
  const router = useRouter()
  const { handlePrevStep } = useStepState()
  const { uploadFlowState } = useUploadFlowState()

  const { mutateAsync: prepareUploadFlow, isPending } = useMutation(
    trpc.uploadFlow.prepareUploadFlow.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t("saveFailed"))
      },
    }),
  )

  const handlePrepare = async () => {
    const prepareUploadFlowInputResult = buildPrepareUploadFlowInputResult(domain, uploadFlowState)
    const completedSearchParamsResult = buildPrepareCompletedSearchParamsResult(uploadFlowState)

    if (!prepareUploadFlowInputResult.ok || !completedSearchParamsResult.ok) {
      const issueLabels: string[] = []

      if (!prepareUploadFlowInputResult.ok) {
        issueLabels.push(
          ...getUploadFlowIssueMessageKeys(prepareUploadFlowInputResult.issues).map((messageKey) =>
            commonT(messageKey),
          ),
        )
      }
      if (!completedSearchParamsResult.ok) {
        issueLabels.push(
          ...getUploadFlowIssueMessageKeys(completedSearchParamsResult.issues).map((messageKey) =>
            commonT(messageKey),
          ),
        )
      }

      toast.error(
        issueLabels.length > 0
          ? commonT("missingRequiredInfoDetailed", {
              fields: issueLabels.join(", "),
            })
          : commonT("missingRequiredInfo"),
      )
      return
    }

    try {
      await prepareUploadFlow(prepareUploadFlowInputResult.data)

      const serializedParams = flowStateClientParamSerializer(completedSearchParamsResult.data)

      router.replace(
        formatDomainPathname(`/live/marathon/prepare/completed${serializedParams}`, domain, "live"),
      )
    } catch {
      return
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-[70dvh] space-y-10 flex flex-col justify-center">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
          {t("reviewTitle")}
        </CardTitle>
        <CardDescription className="text-center">{t("reviewDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/50 px-5 py-4 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("participantNumberLabel")}
          </p>
          <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-foreground">
            {uploadFlowState.participantRef}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label={t("participantLabel")}>
            {uploadFlowState.participantFirstName} {uploadFlowState.participantLastName}
          </InfoRow>
          <InfoRow label={t("emailLabel")}>{uploadFlowState.participantEmail}</InfoRow>
          <InfoRow label={t("classLabel")}>{competitionClass.name}</InfoRow>
          <InfoRow label={t("deviceLabel")}>{deviceGroup.name}</InfoRow>
        </div>

        <p className="text-sm text-muted-foreground text-center pt-2">{t("nextBody")}</p>
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <PrimaryButton
          onClick={() => void handlePrepare()}
          disabled={isPending}
          className="w-full py-3.5 text-base sm:text-lg rounded-full"
        >
          {isPending ? <Loader2 className="animate-spin" /> : t("confirm")}
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
      </CardFooter>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{children}</p>
    </div>
  )
}
