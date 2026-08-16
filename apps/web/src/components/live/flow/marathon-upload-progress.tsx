'use client'

import { Button } from '@/components/ui/button'
import type { Topic } from '@blikka/db'
import { AlertCircle, Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  getUploadErrorPresentation,
  getUploadSummaryPresentation,
} from '@/lib/flow/upload-error-presenter'
import type { UploadFileState } from '@/lib/flow/types'
import { UPLOAD_PHASE } from '@/lib/flow/types'

interface MarathonUploadProgressProps {
  files: UploadFileState[]
  topics: Topic[]
  expectedCount: number
  onRetry?: () => void
  participantReference?: string
}

/**
 * Uploads run at UPLOAD_CONCURRENCY_LIMIT = 1 and go out over `fetch`, which
 * reports no progress events. A file is therefore only ever waiting, in
 * flight, done or failed — there is no percentage to show. Overall progress is
 * a discrete count, and the in-flight row gets indeterminate motion instead of
 * a bar that would have to invent numbers.
 */
type RowPhase = 'waiting' | 'uploading' | 'uploaded' | 'error'

const MIN_UPLOAD_PHASE_DISPLAY_MS = 2000
const ROW_STAGGER_S = 0.035
const EASE_OUT_STRONG = [0.23, 1, 0.32, 1] as const

function toRowPhase(file: UploadFileState | undefined): RowPhase {
  switch (file?.phase) {
    case UPLOAD_PHASE.UPLOADED:
      return 'uploaded'
    case UPLOAD_PHASE.ERROR:
      return 'error'
    case UPLOAD_PHASE.UPLOADING:
      return 'uploading'
    default:
      return 'waiting'
  }
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function RowStatusIcon({ phase }: { phase: RowPhase }) {
  switch (phase) {
    case 'uploaded':
      return <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
    case 'uploading':
      return <Loader2 className="h-4 w-4 animate-spin text-foreground/60" />
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />
    default:
      return <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/25" />
  }
}

export function MarathonUploadProgress({
  files,
  topics,
  expectedCount,
  onRetry,
  participantReference,
}: MarathonUploadProgressProps) {
  const t = useTranslations('FlowPage.uploadProgress')
  const shouldReduceMotion = useReducedMotion()
  const [elapsedTime, setElapsedTime] = useState(0)
  const [minTimeReached, setMinTimeReached] = useState(false)
  const mountedAt = useRef(0)

  useEffect(() => {
    mountedAt.current = Date.now()
  }, [])

  const rows = useMemo(
    () =>
      Array.from({ length: expectedCount }, (_, orderIndex) => ({
        orderIndex,
        name: topics.find((topic) => topic.orderIndex === orderIndex)?.name,
        phase: toRowPhase(files.find((file) => file.orderIndex === orderIndex)),
      })),
    [files, topics, expectedCount],
  )

  const completed = rows.filter((row) => row.phase === 'uploaded').length
  const failed = rows.filter((row) => row.phase === 'error').length
  const hasFailures = failed > 0

  /* A failure does not stop the queue — the remaining files keep going. Only
     once nothing is left in flight has the upload actually come to rest, and
     only then is retrying safe (retrying earlier would race the live queue). */
  const isSettled = rows.every((row) => row.phase === 'uploaded' || row.phase === 'error')
  const isStalled = hasFailures && isSettled

  const rawUploadsComplete = completed === expectedCount
  const uploadSummary = useMemo(() => getUploadSummaryPresentation(files), [files])

  /* The summary above only reflects the dominant error. Crew diagnosing a
     failure on-site need the per-photo breakdown behind it — which photo, which
     error, and the AWS identifiers to chase it with. */
  const failureDetails = useMemo(
    () =>
      files
        .filter((file) => file.phase === UPLOAD_PHASE.ERROR)
        .map((file) => ({
          orderIndex: file.orderIndex,
          name: topics.find((topic) => topic.orderIndex === file.orderIndex)?.name,
          presentation: getUploadErrorPresentation(file.error),
        })),
    [files, topics],
  )

  useEffect(() => {
    if (!rawUploadsComplete) return

    const elapsed = Date.now() - mountedAt.current
    const remaining = Math.max(0, MIN_UPLOAD_PHASE_DISPLAY_MS - elapsed)

    const timeout = window.setTimeout(() => setMinTimeReached(true), remaining)
    return () => window.clearTimeout(timeout)
  }, [rawUploadsComplete])

  const isFinalizing = rawUploadsComplete && minTimeReached

  useEffect(() => {
    if (rawUploadsComplete) return

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [rawUploadsComplete])

  const rowStatusLabel: Record<RowPhase, string> = {
    waiting: t('statusWaiting'),
    uploading: t('statusUploading'),
    uploaded: t('statusUploaded'),
    error: t('statusFailedShort'),
  }

  const title = isFinalizing
    ? t('titleReceived')
    : isStalled
      ? t('titleIssues')
      : t('titleUploading')

  const description = isFinalizing
    ? t('descriptionFinalizing')
    : isStalled
      ? t('clickToRetry')
      : t('keepPageOpenUntilReceived', { count: expectedCount })

  const liveMessage = isFinalizing
    ? t('descriptionFinalizing')
    : hasFailures
      ? failed === 1
        ? t('oneFileFailed')
        : t('multipleFilesFailed', { count: failed })
      : t('completedOfTotal', { completed, total: expectedCount })

  return (
    <div className="flex min-h-[60dvh] w-full flex-col justify-center">
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>

      {/* Header — same shape as every other step in the flow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-8 text-center"
      >
        <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground">{title}</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </motion.div>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border-2 border-border bg-white">
          <div className="px-5 pt-5 pb-4 text-center">
            {/* The label is centred on the counter's axis, so the elapsed timer is pulled out
                of flow rather than sharing a row that would push the label off-centre. */}
            <div className="relative flex items-center justify-center">
              {isFinalizing ? (
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  {t('uploadsCompleteLabel')}
                </p>
              ) : (
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t('photosReceived')}
                </p>
              )}
              {!isFinalizing && !isStalled && (
                <p className="absolute right-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatTime(elapsedTime)}
                </p>
              )}
            </div>

            <p className="mt-2 font-mono text-4xl font-medium leading-none tabular-nums text-foreground">
              {completed}
              <span className="text-muted-foreground">/{expectedCount}</span>
            </p>

            {isFinalizing && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('finalizingInBackground')}
              </p>
            )}
          </div>

          {/* Doubles as the divider between the count and the list */}
          <div className="relative h-[3px] overflow-hidden bg-border">
            <span
              className={cn(
                'absolute inset-0 origin-left bg-foreground transition-[transform,opacity] duration-[420ms] ease-out-strong',
                isFinalizing && 'opacity-0',
              )}
              style={{ transform: `scaleX(${expectedCount > 0 ? completed / expectedCount : 0})` }}
            />
            {isFinalizing && (
              <span className="absolute inset-0 animate-upload-sweep bg-foreground motion-reduce:animate-none" />
            )}
          </div>

          <ul className="px-5">
            {rows.map((row, index) => (
              <motion.li
                key={row.orderIndex}
                data-phase={row.phase}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.28,
                  delay: index * ROW_STAGGER_S,
                  ease: EASE_OUT_STRONG,
                }}
                className={cn(
                  'flex h-11 items-center gap-3 border-b border-dashed border-border text-sm transition-colors duration-200 last:border-b-0',
                  'text-muted-foreground/50',
                  'data-[phase=uploaded]:text-foreground',
                  'data-[phase=uploading]:font-semibold data-[phase=uploading]:text-foreground',
                  'data-[phase=error]:font-semibold data-[phase=error]:text-destructive',
                )}
              >
                <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums opacity-60">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {row.name ?? t('photoFallbackName', { number: index + 1 })}
                </span>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <RowStatusIcon phase={row.phase} />
                  <span className="sr-only">{rowStatusLabel[row.phase]}</span>
                </span>
              </motion.li>
            ))}
          </ul>

          {/* Belongs to the submission, so it reads as a footer on the same card rather than a
              second floating island. Always mounted — appearing at finalize would jump the list. */}
          {participantReference && (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t('participantNumber')}
              </span>
              <span className="font-mono text-base font-bold tracking-widest text-foreground">
                {participantReference}
              </span>
            </div>
          )}
        </div>

        {hasFailures && (
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: EASE_OUT_STRONG }}
            className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
          >
            <p className="text-sm font-semibold text-destructive">
              {failed === 1 ? t('oneFileFailed') : t('multipleFilesFailed', { count: failed })}
            </p>
            {uploadSummary && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(uploadSummary.bodyKey)}
              </p>
            )}
            {uploadSummary?.actionKey && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(uploadSummary.actionKey)}
              </p>
            )}
            {failureDetails.length > 0 && (
              <details className="group mt-3">
                <summary className="flex cursor-pointer list-none select-none items-center gap-1.5 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronDown
                    className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                  {t('technicalDetails')}
                </summary>
                <ul className="mt-2 space-y-2">
                  {failureDetails.map((failure) => (
                    <li
                      key={failure.orderIndex}
                      className="rounded-lg border border-destructive/20 bg-background/60 p-2.5 text-xs"
                    >
                      <p className="font-medium text-foreground">
                        {String(failure.orderIndex + 1).padStart(2, '0')} ·{' '}
                        {failure.name ??
                          t('photoFallbackName', { number: failure.orderIndex + 1 })}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {t(failure.presentation.titleKey)}
                      </p>
                      {failure.presentation.technicalDetails && (
                        <div className="mt-1.5 space-y-0.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                          {failure.presentation.technicalDetails.awsCode && (
                            <p className="break-all">
                              {t('awsCode')}: {failure.presentation.technicalDetails.awsCode}
                            </p>
                          )}
                          {failure.presentation.technicalDetails.awsRequestId && (
                            <p className="break-all">
                              {t('requestId')}:{' '}
                              {failure.presentation.technicalDetails.awsRequestId}
                            </p>
                          )}
                          {failure.presentation.technicalDetails.httpStatus && (
                            <p>
                              {t('statusCode')}: {failure.presentation.technicalDetails.httpStatus}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {onRetry && isSettled && (
              <div className="mt-4 border-t border-dashed border-destructive/20 pt-4">
                <Button
                  onClick={onRetry}
                  variant="outline"
                  className="h-12 w-full rounded-full border-destructive/50 transition-transform duration-150 ease-out-strong hover:bg-destructive/10 active:scale-[0.97]"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t(uploadSummary?.retryLabelKey ?? 'retry')} ({failed})
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {isFinalizing && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-muted-foreground"
          >
            {t('keepPageOpen')}
          </motion.p>
        )}
      </div>
    </div>
  )
}
