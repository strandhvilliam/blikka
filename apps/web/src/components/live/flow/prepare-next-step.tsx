'use client'

import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/ui/primary-button'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { formatDomainPathname } from '@/lib/utils'
import { flowStateClientParamSerializer } from '@/lib/flow-state-params-client'
import { useUploadFlowState } from '@/hooks/live/flow/use-upload-flow-state'
import { useStepState } from '@/lib/flow/step-state-context'
import type { CompetitionClass, DeviceGroup } from '@blikka/db'
import {
  buildPrepareCompletedSearchParamsResult,
  buildPrepareUploadFlowInputResult,
  getUploadFlowIssueMessageKeys,
} from '@/lib/flow/upload-flow-state'

interface PrepareNextStepProps {
  competitionClass: CompetitionClass
  deviceGroup: DeviceGroup
}

export function PrepareNextStep({ competitionClass, deviceGroup }: PrepareNextStepProps) {
  const t = useTranslations('FlowPage.prepareStep')
  const commonT = useTranslations('FlowPage.uploadStep')
  const trpc = useTRPC()
  const domain = useDomain()
  const router = useRouter()
  const { handlePrevStep } = useStepState()
  const { uploadFlowState } = useUploadFlowState()

  const { mutateAsync: prepareUploadFlow, isPending } = useMutation(
    trpc.uploadFlow.prepareUploadFlow.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t('saveFailed'))
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
          ? commonT('missingRequiredInfoDetailed', {
              fields: issueLabels.join(', '),
            })
          : commonT('missingRequiredInfo'),
      )
      return
    }

    try {
      await prepareUploadFlow(prepareUploadFlowInputResult.data)

      const serializedParams = flowStateClientParamSerializer(completedSearchParamsResult.data)

      router.replace(
        formatDomainPathname(`/live/marathon/prepare/completed${serializedParams}`, domain, 'live'),
      )
    } catch {
      return
    }
  }

  const participantName =
    `${uploadFlowState.participantFirstName} ${uploadFlowState.participantLastName}`.trim()

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.45 }}
        className="mb-8 text-center"
      >
        <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground">
          {t('reviewTitle')}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {t('reviewDescription')}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200, damping: 24 }}
        className="mx-auto w-full max-w-[320px]"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col items-center px-8 pt-8 pb-6">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t('participantNumberLabel')}
            </span>
            <span className="mt-2 font-mono text-4xl font-bold tracking-widest text-foreground">
              {uploadFlowState.participantRef}
            </span>
          </div>

          <div className="relative flex items-center px-6">
            <div className="absolute -left-3 h-6 w-6 rounded-full bg-white shadow-[inset_-1px_0_0_oklch(var(--border))]" />
            <div className="h-px w-full border-t border-dashed border-border" />
            <div className="absolute -right-3 h-6 w-6 rounded-full bg-white shadow-[inset_1px_0_0_oklch(var(--border))]" />
          </div>

          <div className="space-y-4 px-8 pt-6 pb-8">
            <TicketDetail label={t('participantLabel')} value={participantName} />
            <TicketDetail label={t('emailLabel')} value={uploadFlowState.participantEmail} />
            <div className="grid grid-cols-2 gap-4">
              <TicketDetail label={t('classLabel')} value={competitionClass.name} />
              <TicketDetail label={t('deviceLabel')} value={deviceGroup.name} />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="mx-auto mt-8 flex w-full max-w-[320px] flex-col gap-3"
      >
        <PrimaryButton
          onClick={() => void handlePrepare()}
          disabled={isPending}
          className="w-full rounded-full py-3.5"
        >
          {isPending ? <Loader2 className="animate-spin" /> : t('confirm')}
        </PrimaryButton>
        <Button variant="ghost" size="lg" onClick={handlePrevStep} disabled={isPending}>
          {t('back')}
        </Button>
      </motion.div>
    </div>
  )
}

function TicketDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value ?? '-'}</p>
    </div>
  )
}
