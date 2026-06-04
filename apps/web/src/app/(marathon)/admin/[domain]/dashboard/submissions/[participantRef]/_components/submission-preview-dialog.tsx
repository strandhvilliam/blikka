'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Expand,
  ReplaceIcon,
  ImageOff,
  Info,
  XCircle,
  XIcon,
} from 'lucide-react'
import type { Submission, Topic, ValidationResult } from '@blikka/db'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { downloadRemoteUrl } from '../[submissionId]/_lib/download-remote-url'
import {
  getSubmissionDownloadFileName,
  getSubmissionOriginalImageUrl,
  getSubmissionThumbnailImageUrl,
} from '../[submissionId]/_lib/submission-image-urls'
import { SubmissionReplaceDialog } from '../[submissionId]/_components/submission-replace-dialog'
import { getSubmissionCaptureDate, summarizeValidationResults } from '../_lib/submission-helpers'
import { SubmissionPreviewSidebar } from './submission-preview-sidebar'
import {
  getOriginalViewerSource,
  SubmissionOptimizedOriginalImage,
  SubmissionThumbnailImage,
} from '@/components/submission-image'

export interface SubmissionPreviewItem {
  submission: Submission & { topic: Topic }
  validationResults: ValidationResult[]
}

interface SubmissionPreviewDialogProps {
  items: SubmissionPreviewItem[]
  selectedSubmissionId: number | null
  onSelectedSubmissionIdChange: (id: number | null) => void
  participantRef: string
}

export function SubmissionPreviewDialog({
  items,
  selectedSubmissionId,
  onSelectedSubmissionIdChange,
  participantRef,
}: SubmissionPreviewDialogProps) {
  const currentIndex = items.findIndex((item) => item.submission.id === selectedSubmissionId)
  const current = currentIndex >= 0 ? items[currentIndex] : null

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1

  const goPrev = () => {
    if (currentIndex > 0) {
      onSelectedSubmissionIdChange(items[currentIndex - 1].submission.id)
    }
  }

  const goNext = () => {
    if (currentIndex >= 0 && currentIndex < items.length - 1) {
      onSelectedSubmissionIdChange(items[currentIndex + 1].submission.id)
    }
  }

  useEffect(() => {
    if (currentIndex < 0) return

    for (const offset of [-2, -1, 0, 1, 2]) {
      const neighbor = items[currentIndex + offset]
      if (!neighbor) continue
      const url = getSubmissionThumbnailImageUrl(neighbor.submission)
      if (!url) continue
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    }
  }, [currentIndex, items])

  useEffect(() => {
    if (!current) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && hasPrev) {
        event.preventDefault()
        onSelectedSubmissionIdChange(items[currentIndex - 1].submission.id)
      } else if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault()
        onSelectedSubmissionIdChange(items[currentIndex + 1].submission.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, currentIndex, hasPrev, hasNext, items, onSelectedSubmissionIdChange])

  return (
    <Dialog
      open={current !== null}
      onOpenChange={(open) => {
        if (!open) onSelectedSubmissionIdChange(null)
      }}
    >
      <DialogContent
        size="lg"
        showCloseButton={false}
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">
          {current?.submission.topic?.name ?? 'Submission preview'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Preview the submitted photo, validation results and EXIF data.
        </DialogDescription>
        {current ? (
          <SubmissionPreviewBody
            item={current}
            currentIndex={currentIndex}
            total={items.length}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={goPrev}
            onNext={goNext}
            participantRef={participantRef}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface SubmissionPreviewBodyProps {
  item: SubmissionPreviewItem
  currentIndex: number
  total: number
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  participantRef: string
}

function SubmissionPreviewBody({
  item,
  currentIndex,
  total,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  participantRef,
}: SubmissionPreviewBodyProps) {
  const { submission, validationResults } = item
  const topic = submission.topic
  const orderNumber = typeof topic?.orderIndex === 'number' ? topic.orderIndex + 1 : null

  const thumbnailUrl = getSubmissionThumbnailImageUrl(submission)
  const originalUrl = getSubmissionOriginalImageUrl(submission)
  const downloadUrl = originalUrl ?? thumbnailUrl
  const downloadFileName = getSubmissionDownloadFileName(submission)
  const captureDate = getSubmissionCaptureDate(submission)

  const [imageError, setImageError] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [submission.id, thumbnailUrl, originalUrl])

  const { failed, passedCount, hasErrors, hasWarnings } =
    summarizeValidationResults(validationResults)

  function handleDownload() {
    if (!downloadUrl) return
    void downloadRemoteUrl(downloadUrl, downloadFileName)
  }

  return (
    <>
      <header className="relative flex shrink-0 items-start justify-between gap-4 border-b border-border bg-white px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          {orderNumber !== null ? (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background font-mono text-sm font-bold tracking-tight">
              {orderNumber}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="font-gothic truncate text-[17px] font-normal leading-tight tracking-tight">
              {topic?.name ?? 'Untitled topic'}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
              {captureDate ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" strokeWidth={2.2} />
                  Captured {format(captureDate, 'MMM d, HH:mm')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <Info className="h-3 w-3" />
                  No capture timestamp
                </span>
              )}
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className="font-mono">#{submission.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <OverallStatusBadge
            total={validationResults.length}
            hasErrors={hasErrors}
            hasWarnings={hasWarnings}
            failedCount={failed.length}
          />
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close preview">
              <XIcon className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_400px]">
        <ImagePane
          thumbnailUrl={thumbnailUrl}
          originalUrl={originalUrl}
          imageError={imageError}
          onImageError={() => setImageError(true)}
          alt={topic?.name ?? ''}
        />
        <aside className="min-h-[600px] max-h-[600px] overflow-y-auto border-l border-border bg-[#fafaf8]">
          <SubmissionPreviewSidebar
            submission={submission}
            validationResults={validationResults}
            failed={failed}
            passedCount={passedCount}
            downloadFileName={downloadFileName}
          />
        </aside>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-white px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Previous submission"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next submission"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-[11.5px] text-muted-foreground">
            {currentIndex + 1} of {total}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setReplaceOpen(true)}
          >
            <ReplaceIcon className="h-4 w-4" />
            Replace
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleDownload}
            disabled={!downloadUrl}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </footer>

      <SubmissionReplaceDialog
        submissionId={submission.id}
        participantRef={participantRef}
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        hideTrigger
      />
    </>
  )
}

interface OverallStatusBadgeProps {
  total: number
  hasErrors: boolean
  hasWarnings: boolean
  failedCount: number
}

function OverallStatusBadge({
  total,
  hasErrors,
  hasWarnings,
  failedCount,
}: OverallStatusBadgeProps) {
  if (total === 0) {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 text-[11px] font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        Not validated
      </span>
    )
  }
  if (hasErrors) {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-red-500/12 px-2 text-[11px] font-semibold text-red-700">
        <XCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
        {failedCount} {failedCount === 1 ? 'error' : 'errors'}
      </span>
    )
  }
  if (hasWarnings) {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-500/15 px-2 text-[11px] font-semibold text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
        {failedCount} {failedCount === 1 ? 'warning' : 'warnings'}
      </span>
    )
  }
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-emerald-500/12 px-2 text-[11px] font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
      All checks passed
    </span>
  )
}

interface ImagePaneProps {
  thumbnailUrl: string | null
  originalUrl: string | null
  imageError: boolean
  onImageError: () => void
  alt: string
}

function ImagePane({
  thumbnailUrl,
  originalUrl,
  imageError,
  onImageError,
  alt,
}: ImagePaneProps) {
  const openTarget = originalUrl ?? thumbnailUrl
  const viewerSource = getOriginalViewerSource({
    thumbnailUrl,
    originalUrl,
  })
  const viewerSrc = viewerSource.kind !== 'missing' ? viewerSource.src : null

  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    setImageLoaded(false)
  }, [viewerSrc])

  const imageClassName = cn(
    'relative z-[1] h-full w-full object-contain shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)] transition-opacity duration-200',
    imageLoaded ? 'opacity-100' : 'opacity-0',
  )

  let mainContent: ReactNode
  if (viewerSource.kind !== 'missing' && !imageError) {
    mainContent = (
      <>
        {thumbnailUrl && thumbnailUrl !== viewerSrc ? (
          <SubmissionThumbnailImage
            src={thumbnailUrl}
            alt=""
            aria-hidden
            priority
            className="absolute inset-0 h-full w-full object-contain opacity-35 blur-[2px]"
          />
        ) : null}
        {viewerSource.kind === 'optimized-original' ? (
          <SubmissionOptimizedOriginalImage
            src={viewerSource.src}
            alt={alt}
            priority
            onError={onImageError}
            onLoad={() => setImageLoaded(true)}
            className={imageClassName}
          />
        ) : (
          <SubmissionThumbnailImage
            src={viewerSource.src}
            alt={alt}
            priority
            onError={onImageError}
            onLoad={() => setImageLoaded(true)}
            className={imageClassName}
          />
        )}
        {!imageLoaded ? (
          <div
            className="pointer-events-none absolute inset-0 animate-pulse rounded-lg bg-white/[0.04]"
            aria-hidden
          />
        ) : null}
        {openTarget ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={openTarget}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open image in new tab"
                  className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/55 text-white/90 backdrop-blur transition-colors hover:bg-black/75"
                >
                  <Expand className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                Open original in new tab
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </>
    )
  } else if (viewerSource.kind !== 'missing' && imageError) {
    mainContent = (
      <div className="flex max-w-xs flex-col items-center gap-3 text-center text-white/85">
        <div className="rounded-full bg-amber-500/15 p-3">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
        </div>
        <p className="text-sm">
          Preview unavailable. The file may be in a RAW or unsupported format.
        </p>
      </div>
    )
  } else {
    mainContent = (
      <div className="flex max-w-xs flex-col items-center gap-3 text-center text-white/70">
        <div className="rounded-full bg-white/5 p-3">
          <ImageOff className="h-6 w-6" />
        </div>
        <p className="text-sm">No image is attached to this submission.</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-[50dvh] h-full min-h-0 overflow-hidden bg-[#0f0f10] md:min-h-[600px]">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative flex h-full w-full items-center justify-center">
          {mainContent}
        </div>
      </div>
    </div>
  )
}
