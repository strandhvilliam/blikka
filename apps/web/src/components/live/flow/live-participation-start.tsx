'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { enUS, sv, type Locale as DateFnsLocale } from 'date-fns/locale'
import { Play, Upload, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/ui/primary-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ByCameraLiveAccessResult } from '@/lib/by-camera/by-camera-live-access-state'

const dateFnsLocales: Record<'en' | 'sv', DateFnsLocale> = { en: enUS, sv }

interface LiveParticipationStartProps {
  marathonMode: 'marathon' | 'by-camera'
  onUploadClick: () => void
  onPrepareClick: () => void
  disabled: boolean
  byCameraAccessState?: ByCameraLiveAccessResult | null
  activeTopic?: {
    scheduledStart: string | null
  } | null
}

export function LiveParticipationStart({
  marathonMode,
  onUploadClick,
  onPrepareClick,
  disabled,
  byCameraAccessState,
  activeTopic,
}: LiveParticipationStartProps) {
  const t = useTranslations('LivePage')
  const locale = useLocale()
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false)

  if (marathonMode === 'marathon') {
    return (
      <>
        <PrimaryButton
          onClick={() => setChoiceDialogOpen(true)}
          disabled={disabled}
          className="w-full py-3 text-base text-white rounded-full"
        >
          {t('beginClassic')}
          <Play className="h-4 w-4" />
        </PrimaryButton>

        <Dialog open={choiceDialogOpen} onOpenChange={setChoiceDialogOpen}>
          <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
            <DialogHeader className="items-center gap-3 px-6 pt-7 pb-4 text-center sm:text-center">
              <DialogTitle className="font-gothic text-xl font-medium tracking-tight">
                {t('uploadChoiceTitle')}
              </DialogTitle>
              <DialogDescription className="text-balance">
                {t('uploadChoiceDescription')}
              </DialogDescription>
            </DialogHeader>

            <ChoiceDivider className="mx-6" />

            <div className="flex flex-col gap-5 px-6 pt-5 pb-6">
              <UploadChoiceOption
                icon="self"
                actionVariant="primary"
                title={t('uploadFromPhoneTitle')}
                body={t('uploadFromPhoneBody')}
                actionLabel={t('uploadFromPhoneAction')}
                onClick={() => {
                  setChoiceDialogOpen(false)
                  onUploadClick()
                }}
              />

              <ChoiceDivider label={t('uploadChoiceOr')} />

              <UploadChoiceOption
                icon="crew"
                actionVariant="outline"
                title={t('staffUploadTitle')}
                body={t('staffUploadBody')}
                actionLabel={t('staffUploadAction')}
                onClick={() => {
                  setChoiceDialogOpen(false)
                  onPrepareClick()
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (byCameraAccessState?.state !== 'open') {
    let message = t('submissionsUnavailable')

    if (byCameraAccessState?.state === 'scheduled' && activeTopic?.scheduledStart) {
      message = t('submissionsScheduled', {
        date: format(new Date(activeTopic.scheduledStart), 'PPp', {
          locale: dateFnsLocales[locale as 'en' | 'sv'] ?? enUS,
        }),
      })
    } else if (byCameraAccessState?.reason === 'missing-scheduled-start') {
      message = t('submissionsNotOpenYet')
    } else if (byCameraAccessState?.state === 'closed') {
      message = t('submissionsClosed')
    }

    return <p className="text-center text-muted-foreground py-4 px-2">{message}</p>
  }

  return (
    <PrimaryButton
      onClick={onUploadClick}
      disabled={disabled}
      className="w-full py-3 text-base text-white rounded-full"
    >
      {t('begin')}
      <Play className="h-4 w-4" />
    </PrimaryButton>
  )
}

function ChoiceDivider({ label, className }: { label?: string; className?: string }) {
  if (label) {
    return (
      <div className={className} aria-hidden>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </div>
    )
  }

  return <div className={className} aria-hidden><div className="h-px bg-border" /></div>
}

function UploadChoiceOption({
  icon,
  actionVariant,
  title,
  body,
  actionLabel,
  onClick,
}: {
  icon: 'self' | 'crew'
  actionVariant: 'primary' | 'outline'
  title: string
  body: string
  actionLabel: string
  onClick: () => void
}) {
  const Icon = icon === 'self' ? Upload : Users

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex flex-col items-center gap-1.5">
        <Icon className="h-4 w-4 text-brand-primary/70" aria-hidden />
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="max-w-[18rem] text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>

      {actionVariant === 'primary' ? (
        <PrimaryButton type="button" onClick={onClick} className="w-full rounded-full py-2.5 text-sm">
          {actionLabel}
        </PrimaryButton>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={onClick}
          className="w-full rounded-full py-2.5 text-sm font-semibold"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
