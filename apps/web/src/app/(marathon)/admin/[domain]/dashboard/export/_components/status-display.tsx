'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatDomainPathname } from '@/lib/utils'
import type { ZipSubmissionStatus } from '../_lib/types'

interface StatusDisplayProps {
  domain: string
  status: ZipSubmissionStatus
}

function submissionsNeedsPackingHref(domain: string): string {
  return formatDomainPathname('/admin/dashboard/submissions?needsPacking=true', domain)
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

  const readyPercent = Math.round(
    (status.withZippedSubmissions / status.totalParticipants) * 100,
  )

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {status.withZippedSubmissions.toLocaleString()} of{' '}
            {status.totalParticipants.toLocaleString()} participants have photo folders ready
          </span>
          <span className="tabular-nums text-muted-foreground">{readyPercent}%</span>
        </div>
        <Progress value={readyPercent} className="h-2" />
      </div>

      <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 space-y-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 min-w-0">
            <p className="font-medium">
              Export blocked — {missingCount.toLocaleString()}{' '}
              {missingCount === 1 ? 'participant needs' : 'participants need'} a packed zip
            </p>
            <p className="text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
              Packing happens per participant in Submissions. Generate a zip for each missing
              participant before starting the marathon export.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
          <Link href={submissionsNeedsPackingHref(domain)}>
            Open submissions needing packing
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
