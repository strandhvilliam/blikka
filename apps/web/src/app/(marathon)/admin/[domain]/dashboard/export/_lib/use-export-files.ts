'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'
import type { RouterOutputs } from '@blikka/api/trpc'

export type ExportFilesView = NonNullable<RouterOutputs['zipFiles']['getExportFiles']>
export type ExportFileRow = ExportFilesView['files'][number]
export type ExportPreview = RouterOutputs['zipFiles']['getExportPreview']

/** Top-level state of the export panel, derived from the active process (or its absence). */
export type ExportTopPhase = 'idle' | 'building' | 'ready' | 'failed'

interface UseExportFilesReturn {
  files: ExportFileRow[]
  preview: ExportPreview | null
  phase: ExportTopPhase
  processId: string | null
  counts: { total: number; ready: number; failed: number; building: number }
  isLoading: boolean
  isBusy: boolean
  retryingJobId: string | null
  actions: {
    build: () => Promise<void>
    cancel: () => Promise<void>
    retryFile: (jobId: string) => Promise<void>
  }
}

export function useExportFiles(domain: string): UseExportFilesReturn {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.zipFiles.pathKey() })

  const filesQuery = useQuery({
    ...trpc.zipFiles.getExportFiles.queryOptions({ domain }),
    staleTime: 1000,
    refetchOnWindowFocus: (query) => {
      const status = query.state.data?.status
      return status === 'initializing' || status === 'processing'
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'initializing' || status === 'processing' ? 2000 : false
    },
  })

  const view = filesQuery.data ?? null

  // The pre-flight summary is only needed when there's no active export to show.
  const previewQuery = useQuery({
    ...trpc.zipFiles.getExportPreview.queryOptions({ domain }),
    enabled: view === null,
    staleTime: 30_000,
  })

  const initializeMutation = useMutation({
    ...trpc.zipFiles.initializeZipDownloads.mutationOptions(),
    onSuccess: invalidate,
  })
  const cancelMutation = useMutation({
    ...trpc.zipFiles.cancelDownloadProcess.mutationOptions(),
    onSuccess: invalidate,
  })
  const retryMutation = useMutation({
    ...trpc.zipFiles.retryExportChunk.mutationOptions(),
    onSuccess: invalidate,
  })

  const files = view?.files ?? []
  const processId = view?.processId ?? null

  const counts = {
    // Fall back to the process's planned chunk count so the header reads "0 of N"
    // (not "0 of 0") in the brief window after build, before the file rows load.
    total: Math.max(files.length, view?.totalChunks ?? 0),
    ready: files.filter((f) => f.status === 'ready').length,
    failed: files.filter((f) => f.status === 'failed').length,
    building: files.filter((f) => f.status === 'building').length,
  }

  const phase: ExportTopPhase =
    view === null
      ? 'idle'
      : view.status === 'initializing' || view.status === 'processing'
        ? 'building'
        : view.status === 'failed'
          ? 'failed'
          : 'ready'

  const build = async () => {
    try {
      const result = await initializeMutation.mutateAsync({ domain })
      if (!('processId' in result) || result.totalChunks === 0) {
        toast.info('Nothing to export', {
          description: 'No participants have finished uploading yet.',
        })
        return
      }
      // Flip to the "building" view immediately. Otherwise the card stays on the idle
      // screen (with the "Build archives" button clickable again) until a background
      // refetch repopulates getExportFiles — which reads as "nothing happened". Seeding
      // status: 'processing' also starts the 2s polling that fills in the file rows.
      queryClient.setQueryData<ExportFilesView | null>(
        trpc.zipFiles.getExportFiles.queryKey({ domain }),
        {
          processId: result.processId,
          status: 'processing',
          totalChunks: result.totalChunks,
          completedChunks: 0,
          failedChunks: 0,
          lastUpdatedAt: new Date().toISOString(),
          files: [],
        },
      )
      toast.success('Building archives', {
        description: 'Files appear below and become downloadable as each one finishes.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
      if (error instanceof TRPCClientError && error.data?.code === 'CONFLICT') {
        toast.error('Export already running', { description: message })
      } else {
        toast.error('Could not start export', { description: message })
      }
    }
  }

  const cancel = async () => {
    if (!processId) return
    try {
      const result = await cancelMutation.mutateAsync({ domain, processId })
      if (result.success) {
        toast.success('Export stopped', { description: result.message })
      } else {
        toast.error('Could not stop export', { description: result.message })
      }
    } catch (error) {
      toast.error('Could not stop export', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      })
    }
  }

  const retryFile = async (jobId: string) => {
    if (!processId) return
    try {
      await retryMutation.mutateAsync({ domain, processId, jobId })
      toast.success('Retrying file', { description: 'Rebuilding this archive.' })
    } catch (error) {
      toast.error('Could not retry file', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      })
    }
  }

  return {
    files,
    preview: previewQuery.data ?? null,
    phase,
    processId,
    counts,
    isLoading: filesQuery.isLoading || (view === null && previewQuery.isLoading),
    isBusy: initializeMutation.isPending || cancelMutation.isPending,
    retryingJobId: retryMutation.isPending ? (retryMutation.variables?.jobId ?? null) : null,
    actions: { build, cancel, retryFile },
  }
}
