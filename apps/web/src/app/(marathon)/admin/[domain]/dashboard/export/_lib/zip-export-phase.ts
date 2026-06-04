import type { ProgressData } from './types'

export type ZipExportUiStep = 'readiness' | 'generate' | 'download'

export type ZipExportPhase =
  | 'idle'
  | 'starting'
  | 'initializing'
  | 'processing'
  | 'completed-loading-urls'
  | 'completed-ready'
  | 'failed'
  | 'cancelled'

export function deriveZipExportPhase(input: {
  isStarting: boolean
  isCancelling: boolean
  activeProcess: ProgressData | null
  hasDownloadUrls: boolean
  isLoadingDownloadUrls: boolean
}): ZipExportPhase {
  if (input.isStarting) return 'starting'
  if (input.isCancelling) return input.activeProcess?.status === 'initializing' ? 'initializing' : 'processing'
  if (!input.activeProcess) return 'idle'

  switch (input.activeProcess.status) {
    case 'initializing':
      return 'initializing'
    case 'processing':
      return 'processing'
    case 'completed':
      if (input.isLoadingDownloadUrls) {
        return 'completed-loading-urls'
      }
      if (input.hasDownloadUrls) {
        return 'completed-ready'
      }
      return 'completed-loading-urls'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'idle'
  }
}

export function isZipExportPhaseInProgress(phase: ZipExportPhase): boolean {
  return phase === 'initializing' || phase === 'processing' || phase === 'starting'
}

const STALLED_EXPORT_THRESHOLD_MS = 2 * 60 * 1000

export function isZipExportStalled(progress: ProgressData | null): boolean {
  if (!progress) return false
  if (progress.status !== 'processing' && progress.status !== 'initializing') return false

  const processedChunks = progress.completedChunks + progress.failedChunks
  if (processedChunks > 0) return false

  if (!progress.lastUpdatedAt) return false

  const lastUpdated = new Date(progress.lastUpdatedAt).getTime()
  if (Number.isNaN(lastUpdated)) return false

  return Date.now() - lastUpdated >= STALLED_EXPORT_THRESHOLD_MS
}

export function canResetZipExport(phase: ZipExportPhase, progress: ProgressData | null): boolean {
  return (
    phase === 'failed' ||
    phase === 'cancelled' ||
    isZipExportStalled(progress) ||
    isZipExportPhaseInProgress(phase)
  )
}

export function getZipExportUiStep(phase: ZipExportPhase): ZipExportUiStep {
  switch (phase) {
    case 'starting':
    case 'initializing':
    case 'processing':
    case 'failed':
    case 'cancelled':
      return 'generate'
    case 'completed-loading-urls':
    case 'completed-ready':
      return 'download'
    default:
      return 'readiness'
  }
}

export function isZipExportGenerateStepError(phase: ZipExportPhase): boolean {
  return phase === 'failed' || phase === 'cancelled'
}

const ZIP_EXPORT_UI_STEPS: ZipExportUiStep[] = ['readiness', 'generate', 'download']

export function getZipExportStepStatus(
  step: ZipExportUiStep,
  phase: ZipExportPhase,
): 'upcoming' | 'active' | 'complete' | 'error' {
  const currentIndex = ZIP_EXPORT_UI_STEPS.indexOf(getZipExportUiStep(phase))
  const stepIndex = ZIP_EXPORT_UI_STEPS.indexOf(step)

  if (stepIndex < currentIndex) return 'complete'
  if (stepIndex > currentIndex) return 'upcoming'
  if (step === 'generate' && isZipExportGenerateStepError(phase)) return 'error'
  return 'active'
}

export function getZipExportPhaseMessage(phase: ZipExportPhase): string {
  switch (phase) {
    case 'starting':
      return 'Starting export…'
    case 'initializing':
      return 'Preparing batches and queueing background jobs.'
    case 'processing':
      return 'Building photo archives on the server. This usually takes several minutes.'
    case 'completed-loading-urls':
      return 'Preparing download links…'
    case 'completed-ready':
      return 'Your archives are ready. Download each file below.'
    case 'failed':
      return 'Export failed. Reset to clear partial files, then start again.'
    case 'cancelled':
      return 'Export was cancelled. Reset clears any leftover files before you start again.'
    default:
      return 'Confirm every participant has a packed photo folder before starting.'
  }
}

export function formatZipDownloadFilename(url: {
  competitionClassName: string
  minReference: number
  maxReference: number
}): string {
  return `${url.competitionClassName}-${url.minReference}-${url.maxReference}.zip`
}
