'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { cn } from '@/lib/utils'
import { Archive, Loader2, RefreshCw, X } from 'lucide-react'
import { PrimaryButton } from '@/components/ui/primary-button'
import { Button } from '@/components/ui/button'
import { useZipExportProcess } from '../_lib/use-zip-export-process'
import {
  canResetZipExport,
  getZipExportPhaseMessage,
  getZipExportUiStep,
  isZipExportPhaseInProgress,
  isZipExportStalled,
} from '../_lib/zip-export-phase'
import { StatusDisplay } from './status-display'
import { ProgressDisplay } from './progress-display'
import { ZipExportStepIndicator } from './zip-export-step-indicator'
import { ZipDownloadFilesList } from './zip-download-files-list'

interface FullMarathonZipCardProps {
  exportLocked?: boolean
  marathonEndDate?: Date | string | null
}

function formatMarathonEndDate(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function FullMarathonZipCard({ exportLocked = false, marathonEndDate }: FullMarathonZipCardProps) {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: status } = useSuspenseQuery(
    trpc.zipFiles.getZipSubmissionStatus.queryOptions({ domain }),
  )

  const zipExport = useZipExportProcess(domain)
  const { phase, progress, downloadUrls, completionPercentage, isPending, isCancelling, actions } =
    zipExport

  const uiStep = getZipExportUiStep(phase)
  const showProgress = isZipExportPhaseInProgress(phase) && progress !== null
  const isReady = phase === 'completed-ready' && downloadUrls && downloadUrls.length > 0
  const isLoadingDownloads = phase === 'completed-loading-urls'
  const isStalled = isZipExportStalled(progress)
  const showReset = canResetZipExport(phase, progress)
  const hasMissingParticipants = status.missingReferences.length > 0
  const canStartExport =
    !exportLocked &&
    !hasMissingParticipants &&
    status.totalParticipants > 0 &&
    !isZipExportPhaseInProgress(phase)

  const formattedEndDate = formatMarathonEndDate(marathonEndDate)

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-white transition-shadow duration-200',
        exportLocked
          ? 'border-border/60'
          : 'border-border hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]',
      )}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground/60">
          <Archive className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
            Participant photo archives
          </h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
            Download every participant&apos;s uploaded photos, grouped by competition class. Large
            marathons are split into multiple zip files (about 200 participants per file).
          </p>
        </div>
      </div>

      <div className="mx-5 mb-5 space-y-5 pt-4 border-t border-border/50">
        <ZipExportStepIndicator phase={phase} />

        {exportLocked && (
          <div className="rounded-lg border border-red-200/80 bg-red-50/40 px-3 py-2.5 text-sm text-red-900">
            Photo archives are available after the marathon ends
            {formattedEndDate ? ` on ${formattedEndDate}` : ''}.
          </div>
        )}

        {uiStep === 'readiness' && (
          <div className="space-y-4">
            <StatusDisplay domain={domain} status={status} />
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-sm text-muted-foreground">{getZipExportPhaseMessage(phase)}</p>
              <PrimaryButton
                onClick={() => void actions.start()}
                disabled={!canStartExport || isPending}
                className="h-8 px-3 text-xs shrink-0"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5" />
                    Start export
                  </>
                )}
              </PrimaryButton>
            </div>
          </div>
        )}

        {uiStep === 'generate' && (
          <div className="space-y-4">
            {(phase === 'failed' || phase === 'cancelled') && (
              <StatusDisplay domain={domain} status={status} />
            )}
            {showProgress && progress && (
              <ProgressDisplay progress={progress} percentage={completionPercentage} />
            )}
            {isStalled && (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 text-sm text-amber-900">
                No progress detected for a while. The background zip task may not have started.
                Reset the export to clear state and partial files, then try again.
              </div>
            )}
            <p className="text-sm text-muted-foreground">{getZipExportPhaseMessage(phase)}</p>
            <div className="flex justify-end gap-2">
              {phase === 'failed' || phase === 'cancelled' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void actions.reset()}
                    disabled={isCancelling || exportLocked}
                    className="h-8 px-3 text-xs"
                  >
                    {isCancelling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Reset export
                  </Button>
                  <PrimaryButton
                    onClick={() => void actions.retry()}
                    disabled={isPending || isCancelling || exportLocked || hasMissingParticipants}
                    className="h-8 px-3 text-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                  </PrimaryButton>
                </>
              ) : showReset ? (
                <>
                  <PrimaryButton disabled className="h-8 px-3 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {phase === 'starting' ? 'Starting…' : 'Building…'}
                  </PrimaryButton>
                  {phase !== 'starting' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void actions.reset()}
                      disabled={isCancelling || exportLocked}
                      className="h-8 px-3 text-xs"
                    >
                      {isCancelling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Reset export
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}

        {uiStep === 'download' && (
          <div className="space-y-4">
            {showProgress && progress && progress.status !== 'completed' && (
              <ProgressDisplay progress={progress} percentage={completionPercentage} />
            )}
            <p className="text-sm text-muted-foreground">{getZipExportPhaseMessage(phase)}</p>

            {isLoadingDownloads && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                <span>Loading download links…</span>
              </div>
            )}

            {isReady && <ZipDownloadFilesList urls={downloadUrls} />}

            <div className="flex items-center justify-between gap-3 pt-1">
              {isReady && downloadUrls && (
                <p className="text-xs text-muted-foreground">
                  {downloadUrls.length} {downloadUrls.length === 1 ? 'file' : 'files'} ready
                </p>
              )}
              <div className="flex gap-2 ml-auto shrink-0">
                {isReady && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void actions.regenerate()}
                    disabled={isPending || exportLocked}
                    className="h-8 px-3 text-xs"
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Create new export
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
