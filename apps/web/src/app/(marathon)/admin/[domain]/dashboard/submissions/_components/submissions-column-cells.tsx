'use client'

import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, ChevronRight, Clock, Copy, Info, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { RealtimeEnrichedSubmissionTableRow } from '../_lib/submissions-types'

export function CopyableContactCell({
  value,
  copiedToast,
  tabularNums,
}: {
  value: string | null | undefined
  copiedToast: string
  tabularNums?: boolean
}) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  return (
    <button
      type="button"
      title={`${trimmed} — Click to copy`}
      onClick={(e) => {
        e.stopPropagation()
        void (async () => {
          try {
            await navigator.clipboard.writeText(trimmed)
            toast.success(copiedToast)
          } catch {
            toast.error('Could not copy')
          }
        })()
      }}
      className={cn(
        'group flex w-full min-w-0 max-w-[200px] items-center gap-1 rounded-md px-2 py-1 text-left',
        'text-xs text-muted-foreground transition-colors',
        'hover:bg-muted/80 hover:text-foreground active:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
      )}
    >
      <span className={cn('min-w-0 flex-1 truncate', tabularNums && 'tabular-nums')}>
        {trimmed}
      </span>
      <Copy
        className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70"
        aria-hidden
      />
    </button>
  )
}

export function ReferenceCell({ reference }: { reference: string }) {
  return <div className="font-semibold text-xs text-foreground">{reference}</div>
}

export function NameCell({ firstname, lastname }: { firstname: string; lastname: string }) {
  return <div className="font-medium text-xs">{`${firstname} ${lastname}`}</div>
}

export function DateCell({
  participant,
  marathonMode,
  createdAt,
}: {
  participant: RealtimeEnrichedSubmissionTableRow
  marathonMode?: string
  createdAt: string
}) {
  const rawDate =
    marathonMode === 'by-camera' ? participant.activeTopicSubmissionCreatedAt : createdAt
  if (!rawDate) {
    return <span className="text-xs text-muted-foreground">-</span>
  }
  const date = new Date(rawDate)
  return <div className="text-xs text-muted-foreground">{format(date, 'MMM d, yyyy, HH:mm')}</div>
}

export function SubmissionStatusBadge({
  participant,
  status,
  marathonMode,
  verificationMode,
}: {
  participant: RealtimeEnrichedSubmissionTableRow
  status: string
  marathonMode?: string
  verificationMode?: string
}) {
  const displayStatus = getSubmissionDisplayStatus({
    participant,
    status,
    marathonMode,
    verificationMode,
  })
  const statusConfig = {
    prepared: {
      variant: 'outline' as const,
      className:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
      icon: Clock,
    },
    completed: {
      variant: 'default' as const,
      className:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
      icon: CheckCircle2,
    },
    initialized: {
      variant: 'outline' as const,
      className:
        'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
      icon: Clock,
    },
    verified: {
      variant: 'default' as const,
      className:
        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
      icon: CheckCircle2,
    },
    'needs-verification': {
      variant: 'outline' as const,
      className:
        'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
      icon: AlertCircle,
    },
  }
  const config =
    statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.initialized
  const Icon = config.icon
  return (
    <Badge
      variant={config.variant}
      className={cn('capitalize text-xs font-medium gap-1 h-5 px-1.5', config.className)}
    >
      <Icon className="size-2.5" />
      {displayStatus.replaceAll('-', ' ')}
    </Badge>
  )
}

/**
 * Maps DB/realtime status to the badge label. Uses Postgres `status` only (no KV reads).
 * Completed rows in marathon mode with `all` or `flagged` verification await admin verify → needs-verification.
 * By-camera marathons never use verification mode; completed stays completed.
 */
export function getSubmissionDisplayStatus({
  participant,
  status,
  marathonMode,
  verificationMode,
}: {
  participant: Pick<RealtimeEnrichedSubmissionTableRow, 'realtimeIsFinalized'>
  status: string
  marathonMode?: string
  verificationMode?: string
}) {
  if (status === 'verified') {
    return 'verified'
  }

  const effectiveStatus = participant.realtimeIsFinalized ? 'completed' : status

  if (
    marathonMode !== 'by-camera' &&
    effectiveStatus === 'completed' &&
    (verificationMode === 'all' || verificationMode === 'flagged')
  ) {
    return 'needs-verification'
  }

  return effectiveStatus
}

export function UploadProgressBadge({
  participant,
  marathonMode,
}: {
  participant: RealtimeEnrichedSubmissionTableRow
  marathonMode?: string
}) {
  const expectedFromClass = participant.competitionClass?.numberOfPhotos ?? null
  const expectedCount =
    expectedFromClass !== null && expectedFromClass > 0
      ? expectedFromClass
      : marathonMode === 'by-camera'
        ? 1
        : null

  if (expectedCount === null) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  const isCompleted =
    participant.realtimeIsFinalized ||
    participant.status === 'completed' ||
    participant.status === 'verified'
  const processedCount = isCompleted
    ? expectedCount
    : Math.min(participant.realtimeProcessedCount, expectedCount)

  return (
    <Badge
      variant={processedCount === expectedCount ? 'default' : 'outline'}
      className={cn(
        'h-5 px-1.5 text-xs font-medium tabular-nums',
        processedCount === expectedCount
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
          : 'text-muted-foreground',
      )}
    >
      {processedCount}/{expectedCount}
    </Badge>
  )
}

export function VotedBadge({ votedAt }: { votedAt: string | null | undefined }) {
  if (votedAt) {
    const date = new Date(votedAt)
    return (
      <Badge
        variant="default"
        className="gap-1 text-xs font-medium h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
      >
        <CheckCircle2 className="size-2.5" />
        Voted on{' '}
        {date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 text-xs font-medium h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
    >
      <Clock className="size-2.5" />
      Not voted
    </Badge>
  )
}

export function CompetitionClassCell({
  participant,
}: {
  participant: RealtimeEnrichedSubmissionTableRow
}) {
  const competitionClass = participant.competitionClass
  return <div className="text-xs">{competitionClass?.name || '-'}</div>
}

export function DeviceGroupCell({
  participant,
}: {
  participant: RealtimeEnrichedSubmissionTableRow
}) {
  const deviceGroup = participant.deviceGroup
  return <div className="text-xs">{deviceGroup?.name || '-'}</div>
}

export function ValidationResultsBadges({
  participant,
}: {
  participant: RealtimeEnrichedSubmissionTableRow
}) {
  const submissionHealth = participant.submissionHealth
  const hasMissingExif = submissionHealth !== null && !submissionHealth.hasExif
  const failed = participant.failedValidationResults
  const passed = participant.passedValidationResults
  const skipped = participant.skippedValidationResults
  const failedCount = failed.errors + failed.warnings
  const passedCount = passed.errors + passed.warnings
  const skippedCount = skipped.errors + skipped.warnings
  return (
    <div className="flex items-center gap-1.5">
      {failedCount > 0 && (
        <Badge variant="destructive" className="gap-1 text-xs font-medium h-5 px-1.5">
          <XCircle className="size-2.5" />
          {failedCount}
        </Badge>
      )}
      {passedCount > 0 && (
        <Badge
          variant="default"
          className="gap-1 text-xs font-medium h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
        >
          <CheckCircle2 className="size-2.5" />
          {passedCount}
        </Badge>
      )}
      {skippedCount > 0 && (
        <Badge
          variant="outline"
          className="gap-1 text-xs font-medium h-5 px-1.5 text-muted-foreground"
        >
          <AlertCircle className="size-2.5" />
          {skippedCount}
        </Badge>
      )}
      {hasMissingExif && (
        <Badge
          variant="outline"
          className="gap-1 text-xs font-medium h-5 px-1.5 border-amber-200 bg-amber-50 text-amber-700"
          title="Active submission is missing EXIF"
        >
          <Info className="size-2.5" />
          No EXIF
        </Badge>
      )}
      {failedCount === 0 && passedCount === 0 && skippedCount === 0 && (
        <span className="text-xs text-muted-foreground">-</span>
      )}
    </div>
  )
}

export function OpenIndicatorCell() {
  return (
    <div className="flex justify-end">
      <ChevronRight className="size-3.5 text-muted-foreground/80 shrink-0" aria-hidden />
    </div>
  )
}
