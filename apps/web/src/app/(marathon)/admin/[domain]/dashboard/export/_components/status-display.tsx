'use client'

import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AlertTriangle, CheckCircle, MoreHorizontal } from 'lucide-react'
import { formatDomainPathname } from '@/lib/utils'
import type { ZipSubmissionStatus } from '../_lib/types'

interface StatusDisplayProps {
  domain: string
  status: ZipSubmissionStatus
}

export function StatusDisplay({ domain, status }: StatusDisplayProps) {
  if (status.totalParticipants === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span>No participants are registered for this marathon yet.</span>
      </div>
    )
  }

  const missingCount = status.missingReferences.length
  const hasAllReady = missingCount === 0

  if (hasAllReady) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle className="h-4 w-4" />
        <span>
          All {status.totalParticipants.toLocaleString()} participants have photo folders ready
          for export.
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {status.withZippedSubmissions.toLocaleString()} of{' '}
          {status.totalParticipants.toLocaleString()} participants have photo folders ready.
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{missingCount.toLocaleString()} still need packing before export: </span>
        {missingCount <= 3 ? (
          <div className="flex gap-1">
            {status.missingReferences.map((ref) => (
              <Link
                key={ref}
                href={formatDomainPathname('/admin/dashboard/submissions/' + ref, domain)}
                className="font-mono text-amber-700 dark:text-amber-400 hover:underline"
              >
                #{ref}
              </Link>
            ))}
          </div>
        ) : missingCount <= 8 ? (
          <div className="flex gap-1 flex-wrap">
            {status.missingReferences.slice(0, 8).map((ref) => (
              <Link
                key={ref}
                href={formatDomainPathname('/admin/dashboard/submissions/' + ref, domain)}
                className="font-mono text-amber-700 dark:text-amber-400 hover:underline"
              >
                #{ref}
              </Link>
            ))}
          </div>
        ) : (
          <MissingParticipantsPopover domain={domain} references={status.missingReferences} />
        )}
      </div>
    </div>
  )
}

interface MissingParticipantsPopoverProps {
  domain: string
  references: string[]
}

function MissingParticipantsPopover({ domain, references }: MissingParticipantsPopoverProps) {
  const displayCount = 12
  const visibleRefs = references.slice(0, displayCount)
  const remainingCount = references.length - displayCount

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1">
          <span>
            {visibleRefs.map((r) => '#' + r).join(', ')}
            {remainingCount > 0 && ' +' + remainingCount + ' more'}
          </span>
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 overflow-y-auto w-64">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Participants not ready for export</h4>
          <div className="grid grid-cols-2 gap-1">
            {references.map((ref) => (
              <Link
                key={ref}
                href={formatDomainPathname('/admin/dashboard/submissions/' + ref, domain)}
                className="text-xs font-mono text-amber-700 dark:text-amber-400 hover:underline p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30"
              >
                #{ref}
              </Link>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
