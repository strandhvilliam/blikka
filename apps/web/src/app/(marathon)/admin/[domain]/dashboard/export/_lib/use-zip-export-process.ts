'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { useTRPC } from '@/lib/trpc/client'
import { toast } from 'sonner'
import type { ProgressData, DownloadUrl } from './types'
import { deriveZipExportPhase, type ZipExportPhase } from './zip-export-phase'

interface UseZipExportProcessReturn {
  phase: ZipExportPhase
  progress: ProgressData | null
  downloadUrls: DownloadUrl[] | null
  completionPercentage: number
  isPending: boolean
  isCancelling: boolean
  actions: {
    start: () => Promise<boolean>
    regenerate: () => Promise<boolean>
    reset: () => Promise<boolean>
    retry: () => Promise<boolean>
  }
}

export function useZipExportProcess(domain: string): UseZipExportProcessReturn {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const activeProcessQuery = useQuery({
    ...trpc.zipFiles.getActiveProcess.queryOptions({ domain }),
    staleTime: 1000,
    refetchOnWindowFocus: (query) => {
      const status = query.state.data?.status
      return status === 'initializing' || status === 'processing'
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'initializing' || status === 'processing') {
        return 2000
      }
      return false
    },
  })

  const activeProcess = activeProcessQuery.data ?? null
  const processId = activeProcess?.processId ?? null

  const downloadUrlsQuery = useQuery({
    ...trpc.zipFiles.getZipDownloadUrls.queryOptions({
      domain,
      processId: processId ?? '',
    }),
    enabled: activeProcess?.status === 'completed' && !!processId,
    staleTime: 60_000,
  })

  const initializeMutation = useMutation({
    ...trpc.zipFiles.initializeZipDownloads.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.zipFiles.pathKey() })
    },
  })

  const cancelMutation = useMutation({
    ...trpc.zipFiles.cancelDownloadProcess.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.zipFiles.pathKey() })
    },
  })

  const progress: ProgressData | null = activeProcess
    ? {
        processId: activeProcess.processId,
        status: activeProcess.status,
        totalChunks: activeProcess.totalChunks,
        completedChunks: activeProcess.completedChunks,
        failedChunks: activeProcess.failedChunks,
        lastUpdatedAt: activeProcess.lastUpdatedAt,
        competitionClasses: activeProcess.competitionClasses,
      }
    : null

  const completionPercentage =
    progress && progress.totalChunks > 0
      ? Math.round(
          ((progress.completedChunks + progress.failedChunks) / progress.totalChunks) * 100,
        )
      : 0

  const downloadUrls = downloadUrlsQuery.data ?? null

  const phase = deriveZipExportPhase({
    isStarting: initializeMutation.isPending,
    isCancelling: cancelMutation.isPending,
    activeProcess: progress,
    hasDownloadUrls: (downloadUrls?.length ?? 0) > 0,
    isLoadingDownloadUrls:
      activeProcess?.status === 'completed' &&
      (downloadUrlsQuery.isLoading || downloadUrlsQuery.isFetching),
  })

  const startGeneration = async (): Promise<boolean> => {
    try {
      const result = await initializeMutation.mutateAsync({ domain })

      if ('totalChunks' in result && result.totalChunks === 0) {
        toast.info('No photo folders ready', {
          description: 'There are no participants with packed photo folders to export.',
        })
        return false
      }

      if ('processId' in result && result.processId) {
        toast.success('Photo export started', {
          description: 'Archives are building on the server. This may take several minutes.',
        })
        return true
      }

      return false
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
      if (error instanceof TRPCClientError && error.data?.code === 'CONFLICT') {
        toast.error('Export already in progress', { description: message })
      } else {
        toast.error('Failed to start photo export', { description: message })
      }
      return false
    }
  }

  const resetExport = async (): Promise<boolean> => {
    if (!processId) return false

    try {
      const result = await cancelMutation.mutateAsync({ domain, processId })

      if (result.success) {
        toast.success('Photo export reset', {
          description: result.message,
        })
        return true
      }

      toast.error('Failed to reset export', { description: result.message })
      return false
    } catch (error) {
      toast.error('Failed to reset export', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      })
      return false
    }
  }

  const retryExport = async (): Promise<boolean> => {
    if (activeProcess?.status === 'failed' || activeProcess?.status === 'cancelled') {
      const reset = await resetExport()
      if (!reset) return false
    }

    return startGeneration()
  }

  return {
    phase,
    progress,
    downloadUrls,
    completionPercentage,
    isPending: initializeMutation.isPending,
    isCancelling: cancelMutation.isPending,
    actions: {
      start: startGeneration,
      regenerate: startGeneration,
      reset: resetExport,
      retry: retryExport,
    },
  }
}
