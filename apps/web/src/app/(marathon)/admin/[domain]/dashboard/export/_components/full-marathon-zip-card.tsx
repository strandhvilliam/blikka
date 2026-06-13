'use client'

import {
  Archive,
  CheckCircle2,
  Download,
  FileArchive,
  Loader2,
  RefreshCw,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/ui/primary-button'
import { Progress } from '@/components/ui/progress'
import { useDomain } from '@/lib/domain-provider'
import { cn } from '@/lib/utils'
import { useExportFiles, type ExportFileRow } from '../_lib/use-export-files'

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

function fileLabel(file: ExportFileRow): string {
  return `${String(file.minReference).padStart(4, '0')}–${String(file.maxReference).padStart(4, '0')}`
}

function fileDownloadName(file: ExportFileRow): string {
  return `${file.competitionClassName}-${file.minReference}-${file.maxReference}.zip`
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function groupByClass(files: ExportFileRow[]): Array<{ className: string; files: ExportFileRow[] }> {
  const groups = new Map<string, ExportFileRow[]>()
  for (const file of files) {
    const list = groups.get(file.competitionClassName)
    if (list) list.push(file)
    else groups.set(file.competitionClassName, [file])
  }
  return [...groups.entries()].map(([className, classFiles]) => ({ className, files: classFiles }))
}

export function FullMarathonZipCard({ exportLocked = false, marathonEndDate }: FullMarathonZipCardProps) {
  const domain = useDomain()
  const { files, preview, phase, counts, isLoading, isBusy, retryingJobId, actions } =
    useExportFiles(domain)

  const formattedEndDate = formatMarathonEndDate(marathonEndDate)
  const processed = counts.ready + counts.failed
  const percentage = counts.total > 0 ? Math.round((processed / counts.total) * 100) : 0
  const groups = groupByClass(files)

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-white transition-shadow duration-200',
        exportLocked ? 'border-border/60' : 'border-border hover:border-border/80',
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
            Download every participant&apos;s uploaded photos, grouped by competition class. Archives
            are built on demand — the first build takes a few minutes; re-runs are near-instant.
          </p>
        </div>
      </div>

      <div className="mx-5 mb-5 space-y-4 pt-4 border-t border-border/50">
        {exportLocked && (
          <div className="rounded-lg border border-red-200/80 bg-red-50/40 px-3 py-2.5 text-sm text-red-900">
            Photo archives are available after the marathon ends
            {formattedEndDate ? ` on ${formattedEndDate}` : ''}.
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
            <span>Loading export status…</span>
          </div>
        )}

        {/* ── Idle: pre-flight summary + Build ── */}
        {!isLoading && phase === 'idle' && (
          <div className="space-y-3">
            {preview && preview.completedParticipants > 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>
                  {preview.completedParticipants.toLocaleString()} completed participant
                  {preview.completedParticipants === 1 ? '' : 's'} ·{' '}
                  {preview.classes.length} {preview.classes.length === 1 ? 'class' : 'classes'} ·{' '}
                  {preview.totalFiles} {preview.totalFiles === 1 ? 'file' : 'files'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TriangleAlert className="h-4 w-4 text-amber-500" />
                <span>No participants have finished uploading yet.</span>
              </div>
            )}
            <div className="flex justify-end">
              <PrimaryButton
                onClick={() => void actions.build()}
                disabled={exportLocked || isBusy || !preview || preview.completedParticipants === 0}
                className="h-8 px-3 text-xs"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                Build archives
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ── Active: progress header + file list ── */}
        {phase !== 'idle' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {phase === 'building'
                    ? `Building ${processed} of ${counts.total} ${counts.total === 1 ? 'file' : 'files'}…`
                    : phase === 'failed'
                      ? `${counts.ready} of ${counts.total} files ready · ${counts.failed} failed`
                      : `All ${counts.total} ${counts.total === 1 ? 'file' : 'files'} ready`}
                </span>
                <span className="tabular-nums text-muted-foreground">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>

            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.className} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.className}
                  </p>
                  <ul className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
                    {group.files.map((file) => (
                      <li
                        key={file.jobId}
                        className="flex items-center gap-3 px-3 py-2.5 bg-muted/20"
                      >
                        <FileStatusIcon status={file.status} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground font-mono">
                            #{fileLabel(file)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {file.status === 'ready'
                              ? 'Ready to download'
                              : file.status === 'failed'
                                ? 'Build failed'
                                : 'Building…'}
                          </p>
                        </div>
                        <FileAction
                          file={file}
                          retrying={retryingJobId === file.jobId}
                          onDownload={() =>
                            file.downloadUrl &&
                            triggerDownload(file.downloadUrl, fileDownloadName(file))
                          }
                          onRetry={() => void actions.retryFile(file.jobId)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              {phase === 'building' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void actions.cancel()}
                  disabled={isBusy}
                  className="h-8 px-3 text-xs"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  Cancel
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void actions.build()}
                  disabled={exportLocked || isBusy}
                  className="h-8 px-3 text-xs"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Create new export
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FileStatusIcon({ status }: { status: ExportFileRow['status'] }) {
  if (status === 'ready') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
  }
  if (status === 'failed') {
    return <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
  }
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
}

function FileAction({
  file,
  retrying,
  onDownload,
  onRetry,
}: {
  file: ExportFileRow
  retrying: boolean
  onDownload: () => void
  onRetry: () => void
}) {
  if (file.status === 'ready') {
    return (
      <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={onDownload}>
        <Download className="h-3.5 w-3.5" />
        Download
      </Button>
    )
  }
  if (file.status === 'failed') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0 text-xs"
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Retry
      </Button>
    )
  }
  return (
    <FileArchive className="h-4 w-4 shrink-0 text-muted-foreground/50" />
  )
}
