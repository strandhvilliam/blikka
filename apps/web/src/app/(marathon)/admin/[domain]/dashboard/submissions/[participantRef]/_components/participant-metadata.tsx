'use client'

import { Camera, Image as ImageIcon, Smartphone, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getStatusConfig, type ParticipantWithRelations } from '../_lib/utils'

function DeviceIcon({ icon, className }: { icon?: string; className?: string }) {
  switch (icon) {
    case 'smartphone':
      return <Smartphone className={className} />
    case 'action-camera':
      return <Zap className={className} />
    default:
      return <Camera className={className} />
  }
}

function StatusPill({ status }: { status: string }) {
  const config = getStatusConfig(status)
  const Icon = config.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        config.color,
        config.bgColor,
        config.borderColor,
      )}
    >
      <Icon
        className={cn('h-3.5 w-3.5', status === 'processing' && 'animate-spin')}
        strokeWidth={2.2}
      />
      {config.label}
    </span>
  )
}

function MetaCell({
  icon,
  label,
  value,
  muted,
  className,
}: {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
  muted?: boolean
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 text-[13px] font-medium leading-tight truncate',
          muted && 'text-muted-foreground font-normal',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function ParticipantMetadata({ participant }: { participant: ParticipantWithRelations }) {
  const submissionCount = participant.submissions?.length ?? 0
  const expectedPhotos = participant.competitionClass?.numberOfPhotos ?? null
  const latestSubmissionAt = participant.submissions?.reduce<string | null>((latest, s) => {
    if (!s.createdAt) return latest
    if (!latest || new Date(s.createdAt) > new Date(latest)) return s.createdAt
    return latest
  }, null)

  return (
    <div className="px-4 py-3 sm:px-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <MetaCell
          label="Status"
          value={<StatusPill status={participant.status} />}
          className="sm:hidden"
        />
        <MetaCell
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          label="Photos"
          value={
            <span className="font-mono">
              {submissionCount}
              {expectedPhotos !== null ? (
                <span className="text-muted-foreground"> / {expectedPhotos}</span>
              ) : null}
            </span>
          }
        />
        <MetaCell
          icon={
            <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] font-bold font-mono">
              {participant.competitionClass?.numberOfPhotos ?? '?'}
            </span>
          }
          label="Class"
          value={participant.competitionClass?.name ?? 'Unassigned'}
          muted={!participant.competitionClass}
        />
        <MetaCell
          icon={<DeviceIcon icon={participant.deviceGroup?.icon} className="h-3.5 w-3.5" />}
          label="Device"
          value={participant.deviceGroup?.name ?? 'Unassigned'}
          muted={!participant.deviceGroup}
        />
        <MetaCell
          label="Submitted"
          value={
            latestSubmissionAt ? format(new Date(latestSubmissionAt), 'MMM d, HH:mm') : '—'
          }
          muted={!latestSubmissionAt}
        />
      </dl>
    </div>
  )
}
