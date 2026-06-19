'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion } from 'motion/react'
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { PrimaryButton } from '@/components/ui/primary-button'
import { formatDomainPathname } from '@/lib/utils'

interface PrepareCompletedClientProps {
  domain: string
  params: {
    participantRef: string
    participantFirstName: string
    participantLastName: string
    participantEmail: string
    competitionClassName?: string
    deviceGroupName?: string
  }
}

export function PrepareCompletedClient({ domain, params }: PrepareCompletedClientProps) {
  const t = useTranslations('FlowPage.prepareCompleted')
  const router = useRouter()

  const participantName =
    `${params.participantFirstName} ${params.participantLastName}`.trim() ||
    t('fallbackParticipant')

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6 sm:px-6 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.5 }}
        className="pt-8 text-center"
      >
        <div className="relative inline-block">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-xl shadow-green-500/30"
          >
            <CheckCircle2 className="h-9 w-9 text-white" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 space-y-2"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {t('eyebrow')}
          </p>
          <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.45, duration: 0.5, type: 'spring', stiffness: 200, damping: 24 }}
        className="mx-auto mt-8 w-full max-w-[320px]"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col items-center px-8 pt-8 pb-6">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t('participantNumberLabel')}
            </span>
            <span className="mt-2 font-mono text-4xl font-bold tracking-widest text-foreground">
              {params.participantRef}
            </span>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
              {t('participantNumberHelp')}
            </p>
          </div>

          <div className="relative flex items-center px-6">
            <div className="absolute -left-3 h-6 w-6 rounded-full bg-white shadow-[inset_-1px_0_0_oklch(var(--border))]" />
            <div className="h-px w-full border-t border-dashed border-border" />
            <div className="absolute -right-3 h-6 w-6 rounded-full bg-white shadow-[inset_1px_0_0_oklch(var(--border))]" />
          </div>

          <div className="space-y-4 px-8 pt-6 pb-8">
            <TicketDetail label={t('participantLabel')} value={participantName} />
            <TicketDetail label={t('emailLabel')} value={params.participantEmail} />
            <TicketDetail label={t('statusLabel')} value={t('statusValue')} />
            {(params.competitionClassName || params.deviceGroupName) && (
              <div className="grid grid-cols-2 gap-4">
                {params.competitionClassName ? (
                  <TicketDetail label={t('classLabel')} value={params.competitionClassName} />
                ) : null}
                {params.deviceGroupName ? (
                  <TicketDetail label={t('deviceLabel')} value={params.deviceGroupName} />
                ) : null}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-4"
      >
        <Card className="border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
          <CardContent className="p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <ShieldCheck className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h2 className="font-rocgrotesk font-bold text-foreground">{t('nextStepsTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('nextStepsDescription')}</p>
              </div>
            </div>

            <div className="grid gap-3">
              <StepRow index={1} title={t('stepOneTitle')} body={t('stepOneBody')} />
              <StepRow index={2} title={t('stepTwoTitle')} body={t('stepTwoBody')} />
              <StepRow index={3} title={t('stepThreeTitle')} body={t('stepThreeBody')} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-8 flex flex-col gap-3"
      >
        <PrimaryButton
          onClick={() =>
            router.replace(formatDomainPathname('/live/marathon/prepare', domain, 'live'))
          }
          className="w-full rounded-full py-3.5 text-base"
        >
          <span>{t('prepareAnother')}</span>
          <ArrowRight className="ml-2 h-5 w-5" />
        </PrimaryButton>
        <p className="text-center text-sm text-muted-foreground">{t('staffEditHelp')}</p>
      </motion.div>
    </div>
  )
}

function TicketDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function StepRow({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{index}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
