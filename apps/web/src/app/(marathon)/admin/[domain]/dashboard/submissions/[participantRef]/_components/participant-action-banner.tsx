'use client'

import { Clock, Loader2, Shield, Upload, type LucideIcon } from 'lucide-react'
import { PrimaryButton } from '@/components/ui/primary-button'
import { cn } from '@/lib/utils'
import type { ParticipantWithRelations } from '../_lib/utils'

interface ParticipantActionBannerProps {
  participant: ParticipantWithRelations
  onVerify: () => void
}

interface BannerConfig {
  icon: LucideIcon
  iconAnimate?: boolean
  title: string
  description: string
  tone: 'info' | 'warning' | 'attention'
  action?: { label: string; icon: LucideIcon; onClick: () => void }
}

const toneStyles: Record<BannerConfig['tone'], { bar: string; icon: string; titleColor: string }> = {
  info: {
    bar: 'border-blue-200 bg-blue-50/60',
    icon: 'bg-blue-500/10 text-blue-600',
    titleColor: 'text-blue-900',
  },
  warning: {
    bar: 'border-amber-200 bg-amber-50/70',
    icon: 'bg-amber-500/15 text-amber-700',
    titleColor: 'text-amber-900',
  },
  attention: {
    bar: 'border-brand-primary/20 bg-brand-primary/5',
    icon: 'bg-brand-primary/10 text-brand-primary',
    titleColor: 'text-brand-primary',
  },
}

function buildBannerConfig(
  participant: ParticipantWithRelations,
  onVerify: () => void,
): BannerConfig | null {
  switch (participant.status) {
    case 'prepared':
    case 'initialized':
    case 'ready_to_upload':
      return {
        icon: Upload,
        title: 'Waiting for upload',
        description:
          'The participant has been registered but has not uploaded their photos yet.',
        tone: 'info',
      }
    case 'processing':
      return {
        icon: Loader2,
        iconAnimate: true,
        title: 'Processing submissions',
        description: 'Photos are being uploaded and processed. Hang tight.',
        tone: 'info',
      }
    case 'completed':
      return {
        icon: Clock,
        title: 'Awaiting verification',
        description:
          'All photos have been uploaded. Review the submissions below and verify the participant when everything looks good.',
        tone: 'attention',
        action: {
          label: 'Verify participant',
          icon: Shield,
          onClick: onVerify,
        },
      }
    default:
      return null
  }
}

export function ParticipantActionBanner({ participant, onVerify }: ParticipantActionBannerProps) {
  const config = buildBannerConfig(participant, onVerify)
  if (!config) return null

  const styles = toneStyles[config.tone]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:py-3',
        styles.bar,
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          styles.icon,
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', config.iconAnimate && 'animate-spin')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold leading-tight', styles.titleColor)}>
          {config.title}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
          {config.description}
        </p>
      </div>
      {config.action ? (
        <PrimaryButton
          className="h-9 w-full text-xs sm:w-auto"
          onClick={config.action.onClick}
        >
          <config.action.icon className="h-3.5 w-3.5" />
          {config.action.label}
        </PrimaryButton>
      ) : null}
    </div>
  )
}
