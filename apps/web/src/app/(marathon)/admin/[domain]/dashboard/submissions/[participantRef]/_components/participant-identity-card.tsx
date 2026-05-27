'use client'

import {
  ArrowLeft,
  Camera,
  Download,
  Image as ImageIcon,
  Mail,
  MoreVertical,
  RefreshCw,
  Smartphone,
  Trash2,
  UserPen,
  Grid3x3,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatDomainPathname } from '@/lib/utils'
import { useDomain } from '@/lib/domain-provider'
import { getStatusConfig, type ParticipantWithRelations } from '../_lib/utils'

function getInitials(firstname?: string | null, lastname?: string | null) {
  const a = firstname?.trim().charAt(0) ?? ''
  const b = lastname?.trim().charAt(0) ?? ''
  return (a + b).toUpperCase() || '?'
}

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

interface ParticipantIdentityCardProps {
  participant: ParticipantWithRelations
  marathonMode: string
  onEditParticipant: () => void
  onRunValidations: () => void
  isRunningValidations: boolean
  onRegenerateContactSheet: () => void
  isGeneratingContactSheet: boolean
  onDeleteParticipant: () => void
  onExport: () => void
}

export function ParticipantIdentityCard({
  participant,
  marathonMode,
  onEditParticipant,
  onRunValidations,
  isRunningValidations,
  onRegenerateContactSheet,
  isGeneratingContactSheet,
  onDeleteParticipant,
  onExport,
}: ParticipantIdentityCardProps) {
  const domain = useDomain()
  const hasSubmissions = (participant.submissions?.length ?? 0) > 0

  const submissionCount = participant.submissions?.length ?? 0
  const expectedPhotos = participant.competitionClass?.numberOfPhotos ?? null
  const latestSubmissionAt = participant.submissions?.reduce<string | null>((latest, s) => {
    if (!s.createdAt) return latest
    if (!latest || new Date(s.createdAt) > new Date(latest)) return s.createdAt
    return latest
  }, null)

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0 -ml-1">
          <Link
            href={formatDomainPathname('/admin/dashboard/submissions', domain)}
            aria-label="Back to submissions"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <Avatar className="h-12 w-12 shrink-0 rounded-xl">
          <AvatarFallback className="rounded-xl bg-brand-primary/10 text-brand-primary text-sm font-bold font-gothic tracking-wide">
            {getInitials(participant.firstname, participant.lastname)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Participant #{participant.reference}
          </p>
          <h1 className="font-gothic text-xl sm:text-2xl font-bold leading-tight tracking-tight truncate">
            {participant.firstname} {participant.lastname}
          </h1>
          {participant.email ? (
            <Link
              href={`mailto:${participant.email}`}
              className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:underline"
            >
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{participant.email}</span>
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:block">
            <StatusPill status={participant.status} />
          </div>
          {hasSubmissions ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="text-xs h-8"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          ) : null}
          {marathonMode === 'marathon' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditParticipant}
              className="text-xs h-8"
            >
              <UserPen className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden md:inline">Edit details</span>
              <span className="md:hidden">Edit</span>
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={onRunValidations}
                disabled={isRunningValidations || !hasSubmissions}
              >
                <RefreshCw
                  className={cn('h-4 w-4 mr-2', isRunningValidations && 'animate-spin')}
                />
                Re-run validations
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onRegenerateContactSheet}
                disabled={isGeneratingContactSheet || !hasSubmissions}
              >
                <Grid3x3 className="h-4 w-4 mr-2" />
                Regenerate contact sheet
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDeleteParticipant}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete participant
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
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
              latestSubmissionAt
                ? format(new Date(latestSubmissionAt), 'MMM d, HH:mm')
                : '—'
            }
            muted={!latestSubmissionAt}
          />
        </dl>
      </div>
    </div>
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
