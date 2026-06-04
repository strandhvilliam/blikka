'use client'

import { cn } from '@/lib/utils'
import { Check, AlertCircle, Loader2 } from 'lucide-react'
import {
  getZipExportStepStatus,
  isZipExportPhaseInProgress,
  type ZipExportPhase,
  type ZipExportUiStep,
} from '../_lib/zip-export-phase'

const STEPS: { id: ZipExportUiStep; label: string }[] = [
  { id: 'readiness', label: 'Check readiness' },
  { id: 'generate', label: 'Build archives' },
  { id: 'download', label: 'Download files' },
]

interface ZipExportStepIndicatorProps {
  phase: ZipExportPhase
}

export function ZipExportStepIndicator({ phase }: ZipExportStepIndicatorProps) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
      {STEPS.map((step, index) => {
        const status = getZipExportStepStatus(step.id, phase)
        const isLast = index === STEPS.length - 1
        const showSpinner =
          status === 'active' &&
          ((step.id === 'generate' && isZipExportPhaseInProgress(phase)) ||
            (step.id === 'download' && phase === 'completed-loading-urls'))

        return (
          <li key={step.id} className="flex items-center min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <StepIcon status={status} index={index} showSpinner={showSpinner} />
              <span
                className={cn(
                  'text-xs font-medium truncate',
                  status === 'active' && 'text-foreground',
                  status === 'complete' && 'text-muted-foreground',
                  status === 'upcoming' && 'text-muted-foreground/60',
                  status === 'error' && 'text-red-700',
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'hidden sm:block mx-3 h-px flex-1 min-w-[1.5rem]',
                  status === 'complete' ? 'bg-brand-primary/40' : 'bg-border',
                )}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function StepIcon({
  status,
  index,
  showSpinner,
}: {
  status: 'upcoming' | 'active' | 'complete' | 'error'
  index: number
  showSpinner: boolean
}) {
  if (status === 'complete') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    )
  }

  if (status === 'active') {
    if (showSpinner) {
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
        </span>
      )
    }
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white text-[11px] font-semibold">
        {index + 1}
      </span>
    )
  }

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground/70">
      {index + 1}
    </span>
  )
}
