'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ImageOff,
  Info,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Submission, ValidationResult, Topic } from '@blikka/db'
import { cn, formatDomainPathname } from '@/lib/utils'
import { useDomain } from '@/lib/domain-provider'

interface ParticipantSubmissionCardProps {
  submission: Submission & { topic: Topic }
  validationResults: ValidationResult[]
  participantRef: string
}

const AWS_S3_BASE_URL = 'https://s3.eu-north-1.amazonaws.com'

function getImageUrl(submission: Submission): string | null {
  const thumbnailBaseUrl = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
  const submissionBaseUrl = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME

  if (submission.thumbnailKey && thumbnailBaseUrl) {
    return `${AWS_S3_BASE_URL}/${thumbnailBaseUrl}/${submission.thumbnailKey}`
  }
  if (submission.key && submissionBaseUrl) {
    return `${AWS_S3_BASE_URL}/${submissionBaseUrl}/${submission.key}`
  }
  return null
}

const EXIF_CAPTURE_KEYS = ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] as const

function getCaptureDate(submission: Submission): Date | null {
  const exif = submission.exif
  if (exif && typeof exif === 'object') {
    for (const key of EXIF_CAPTURE_KEYS) {
      const raw = (exif as Record<string, unknown>)[key]
      if (typeof raw === 'string' && raw) {
        const parsed = new Date(raw)
        if (!Number.isNaN(parsed.getTime())) return parsed
      }
    }
  }
  return null
}

type ValidationState = 'none' | 'valid' | 'warning' | 'error'

function getValidationState(results: ValidationResult[]): ValidationState {
  if (results.length === 0) return 'none'
  const failed = results.filter((r) => r.outcome === 'failed')
  if (failed.some((r) => r.severity === 'error')) return 'error'
  if (failed.some((r) => r.severity === 'warning')) return 'warning'
  return 'valid'
}

export function ParticipantSubmissionCard({
  submission,
  validationResults,
  participantRef,
}: ParticipantSubmissionCardProps) {
  const domain = useDomain()

  const imageUrl = getImageUrl(submission)
  const captureDate = getCaptureDate(submission)
  const validationState = getValidationState(validationResults)
  const hasExif = submission.exif && Object.keys(submission.exif).length > 0
  const hasThumbnail = Boolean(submission.thumbnailKey)
  const orderNumber =
    typeof submission.topic?.orderIndex === 'number' ? submission.topic.orderIndex + 1 : null

  const qualityWarnings: { icon: React.ElementType; label: string }[] = []
  if (!hasExif) qualityWarnings.push({ icon: Info, label: 'No EXIF metadata' })
  if (!hasThumbnail) qualityWarnings.push({ icon: ImageOff, label: 'No thumbnail generated' })

  return (
    <Link
      href={formatDomainPathname(
        `/admin/dashboard/submissions/${participantRef}/${submission.id}`,
        domain,
      )}
      className="group block focus:outline-none"
    >
      <div
        className="overflow-hidden rounded-xl border border-border bg-white transition-[border-color,box-shadow] duration-200 group-hover:border-foreground/20 group-hover:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.08)] group-focus-visible:ring-2 group-focus-visible:ring-brand-primary"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted/40 border-b border-border">
          <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5">
            {orderNumber !== null ? (
              <span className="inline-flex h-6 items-center rounded-md bg-foreground/90 px-1.5 text-[10.5px] font-bold font-mono tracking-tight text-background shadow-sm">
                #{orderNumber}
              </span>
            ) : null}
          </div>

          {qualityWarnings.length > 0 ? (
            <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-white shadow-sm">
                      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">
                    <ul className="space-y-0.5">
                      {qualityWarnings.map((w) => (
                        <li key={w.label} className="flex items-center gap-1.5">
                          <w.icon className="h-3 w-3" />
                          {w.label}
                        </li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : null}

          {imageUrl ? (
            <img
              className="h-full w-full object-cover"
              src={imageUrl}
              alt={submission.topic?.name ?? ''}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageOff className="h-6 w-6" strokeWidth={1.5} />
              <p className="text-[11px]">No preview</p>
            </div>
          )}

          {captureDate ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-start bg-gradient-to-t from-black/55 via-black/15 to-transparent p-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
                <Clock className="h-3 w-3" strokeWidth={2.2} />
                {format(captureDate, 'MMM d · HH:mm')}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5">
          <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">
            {submission.topic?.name ?? 'Untitled Topic'}
          </h3>
          <ValidationBadge state={validationState} results={validationResults} />
        </div>
      </div>
    </Link>
  )
}

function ValidationBadge({
  state,
  results,
}: {
  state: ValidationState
  results: ValidationResult[]
}) {
  if (state === 'none') {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/60"
        aria-label="Not validated"
        title="Not validated"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
      </span>
    )
  }

  const failed = results.filter((r) => r.outcome === 'failed')

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-semibold',
              state === 'valid' && 'bg-emerald-500/12 text-emerald-700',
              state === 'warning' && 'bg-amber-500/15 text-amber-700',
              state === 'error' && 'bg-red-500/12 text-red-700',
            )}
          >
            {state === 'valid' ? (
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
            ) : state === 'error' ? (
              <XCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
            )}
            {state === 'valid'
              ? 'Valid'
              : state === 'error'
                ? failed.filter((r) => r.severity === 'error').length
                : failed.filter((r) => r.severity === 'warning').length}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          {state === 'valid' ? (
            <p className="text-emerald-500">All {results.length} checks passed</p>
          ) : (
            <div className="space-y-1">
              <p
                className={cn(
                  'font-semibold',
                  state === 'error' ? 'text-destructive' : 'text-yellow-500',
                )}
              >
                {state === 'error' ? 'Errors' : 'Warnings'}:
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                {failed.map((result, i) => (
                  <li key={i}>{result.message}</li>
                ))}
              </ul>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
