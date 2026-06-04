import { describe, expect, it } from 'vitest'

import {
  deriveZipExportPhase,
  getZipExportStepStatus,
  getZipExportUiStep,
  isZipExportStalled,
} from './zip-export-phase'
import type { ProgressData } from './types'

const baseProcess: ProgressData = {
  processId: 'process-1',
  status: 'processing',
  totalChunks: 4,
  completedChunks: 1,
  failedChunks: 0,
  competitionClasses: [],
}

describe('deriveZipExportPhase', () => {
  it('returns starting while the initialize mutation is pending', () => {
    expect(
      deriveZipExportPhase({
        isStarting: true,
        isCancelling: false,
        activeProcess: baseProcess,
        hasDownloadUrls: false,
        isLoadingDownloadUrls: false,
      }),
    ).toBe('starting')
  })

  it('returns completed-ready when downloads are available', () => {
    expect(
      deriveZipExportPhase({
        isStarting: false,
        isCancelling: false,
        activeProcess: { ...baseProcess, status: 'completed' },
        hasDownloadUrls: true,
        isLoadingDownloadUrls: false,
      }),
    ).toBe('completed-ready')
  })

  it('returns completed-loading-urls while presigned urls are loading', () => {
    expect(
      deriveZipExportPhase({
        isStarting: false,
        isCancelling: false,
        activeProcess: { ...baseProcess, status: 'completed' },
        hasDownloadUrls: false,
        isLoadingDownloadUrls: true,
      }),
    ).toBe('completed-loading-urls')
  })

  it('returns idle when there is no active process', () => {
    expect(
      deriveZipExportPhase({
        isStarting: false,
        isCancelling: false,
        activeProcess: null,
        hasDownloadUrls: false,
        isLoadingDownloadUrls: false,
      }),
    ).toBe('idle')
  })
})

describe('getZipExportUiStep', () => {
  it('maps idle to readiness', () => {
    expect(getZipExportUiStep('idle')).toBe('readiness')
  })

  it('maps processing to generate', () => {
    expect(getZipExportUiStep('processing')).toBe('generate')
  })

  it('maps completed-ready to download', () => {
    expect(getZipExportUiStep('completed-ready')).toBe('download')
  })
})

describe('getZipExportStepStatus', () => {
  it('marks earlier steps complete when on download', () => {
    expect(getZipExportStepStatus('readiness', 'completed-ready')).toBe('complete')
    expect(getZipExportStepStatus('generate', 'completed-ready')).toBe('complete')
    expect(getZipExportStepStatus('download', 'completed-ready')).toBe('active')
  })

  it('marks generate as error when export failed', () => {
    expect(getZipExportStepStatus('generate', 'failed')).toBe('error')
    expect(getZipExportStepStatus('readiness', 'failed')).toBe('complete')
  })
})

describe('isZipExportStalled', () => {
  it('returns true when processing has made no progress for several minutes', () => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()

    expect(
      isZipExportStalled({
        processId: 'process-1',
        status: 'processing',
        totalChunks: 2,
        completedChunks: 0,
        failedChunks: 0,
        lastUpdatedAt: threeMinutesAgo,
        competitionClasses: [],
      }),
    ).toBe(true)
  })

  it('returns false once any chunk has completed or failed', () => {
    expect(
      isZipExportStalled({
        processId: 'process-1',
        status: 'processing',
        totalChunks: 2,
        completedChunks: 1,
        failedChunks: 0,
        lastUpdatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        competitionClasses: [],
      }),
    ).toBe(false)
  })
})
