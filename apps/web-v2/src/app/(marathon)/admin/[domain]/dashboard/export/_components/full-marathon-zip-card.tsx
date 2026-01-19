"use client"

import { useEffect, useState } from "react"
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { formatDomainPathname } from "@/lib/utils"
import Link from "next/link"
import {
  Archive,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  MoreHorizontal,
  FileArchive,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Button } from "@/components/ui/button"

interface FullMarathonZipCardProps {
  disabled?: boolean
}

// Types for better type safety
interface ProgressData {
  processId: string
  status: "initializing" | "processing" | "completed" | "failed" | "cancelled"
  totalChunks: number
  completedChunks: number
  failedChunks: number
  lastUpdatedAt?: string
  competitionClasses: ReadonlyArray<{
    competitionClassName: string
    totalChunks: number
  }>
}

interface DownloadUrl {
  competitionClassName: string
  minReference: number
  maxReference: number
  zipKey: string
  downloadUrl: string
}

/**
 * Custom hook to manage zip download process state.
 * Uses server-side process tracking, eliminating localStorage dependency.
 */
function useZipDownloadProcess(domain: string) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [refetchInterval, setRefetchInterval] = useState<number | false>(false)

  // Fetch active process from server (no localStorage needed)
  const {
    data: activeProcess,
    isLoading: isLoadingActive,
    refetch: refetchActiveProcess,
  } = useQuery(
    trpc.zipFiles.getActiveProcess.queryOptions(
      { domain },
      {
        refetchInterval,
        staleTime: 1000,
      }
    )
  )

  // Derive processId from active process
  const processId = activeProcess?.processId ?? null

  // Fetch download URLs when completed
  const { data: downloadUrls } = useQuery(
    trpc.zipFiles.getZipDownloadUrls.queryOptions(
      { domain, processId: processId ?? "" },
      {
        enabled: !!processId && activeProcess?.status === "completed",
        staleTime: 60000, // URLs are valid for 24h, cache for 1min
      }
    )
  )

  // Initialize mutation
  const initializeMutation = useMutation(trpc.zipFiles.initializeZipDownloads.mutationOptions())

  // Cancel mutation
  const cancelMutation = useMutation(trpc.zipFiles.cancelDownloadProcess.mutationOptions())

  // Manage polling based on status
  useEffect(() => {
    if (!activeProcess) {
      setRefetchInterval(false)
      return
    }

    if (activeProcess.status === "initializing" || activeProcess.status === "processing") {
      setRefetchInterval(2000)
    } else {
      setRefetchInterval(false)
    }
  }, [activeProcess?.status])

  const startGeneration = async () => {
    const result = await initializeMutation.mutateAsync({ domain })

    if ("totalChunks" in result && result.totalChunks === 0) {
      toast.info("No zipped submissions found", {
        description: "There are no participants with zipped submissions to process.",
      })
      return false
    }

    if ("processId" in result) {
      toast.success("Zip generation started", {
        description: "Processing has begun. This may take several minutes.",
      })
      // Refetch active process to pick up new process
      await refetchActiveProcess()
      setRefetchInterval(2000)
      return true
    }

    return false
  }

  const cancelGeneration = async () => {
    if (!processId) return false

    const result = await cancelMutation.mutateAsync({ domain, processId })

    if (result.success) {
      toast.info("Zip generation cancelled")
      await refetchActiveProcess()
      return true
    } else {
      toast.error("Failed to cancel", { description: result.message })
      return false
    }
  }

  const status = activeProcess?.status ?? null
  const isIdle =
    !activeProcess || status === "completed" || status === "failed" || status === "cancelled"
  const isProcessing = status === "initializing" || status === "processing"
  const isCompleted = status === "completed"
  const isFailed = status === "failed"
  const isCancelled = status === "cancelled"

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
          ((progress.completedChunks + progress.failedChunks) / progress.totalChunks) * 100
        )
      : 0

  return {
    progress,
    downloadUrls: downloadUrls ?? null,
    isIdle,
    isProcessing,
    isCompleted,
    isFailed,
    isCancelled,
    isLoading: isLoadingActive,
    completionPercentage,
    isPending: initializeMutation.isPending,
    isCancelling: cancelMutation.isPending,
    actions: {
      start: startGeneration,
      cancel: cancelGeneration,
      retry: startGeneration,
    },
  }
}

export function FullMarathonZipCard({ disabled }: FullMarathonZipCardProps) {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: status } = useSuspenseQuery(
    trpc.zipFiles.getZipSubmissionStatus.queryOptions({ domain })
  )

  const zipProcess = useZipDownloadProcess(domain)

  const handleGenerateZip = async () => {
    try {
      await zipProcess.actions.start()
    } catch (error) {
      toast.error("Failed to start zip generation", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      })
    }
  }

  const handleCancel = async () => {
    try {
      await zipProcess.actions.cancel()
    } catch (error) {
      toast.error("Failed to cancel", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      })
    }
  }

  const accentBg = "rgba(139, 92, 246, 0.12)"

  return (
    <Card
      className={cn(
        "group relative transition-all duration-200 py-6!",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-md"
      )}
    >
      <CardHeader className="space-y-0 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                "ring-1 ring-border text-muted-foreground"
              )}
              style={{ background: accentBg }}
            >
              <Archive className="h-5 w-5 text-violet-600" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold font-rocgrotesk leading-none">Full Marathon Zip</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                Generate a complete zip archive of all participant submissions.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full">
            ZIP
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <StatusDisplay domain={domain} status={status} />
        </div>

        {zipProcess.isProcessing && zipProcess.progress && (
          <div className="space-y-2">
            <ProgressDisplay
              progress={zipProcess.progress}
              percentage={zipProcess.completionPercentage}
            />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {zipProcess.isProcessing
              ? "Generating zip files. This may take several minutes."
              : "All participants must have zipped submissions before generating."}
          </p>
          <div className="flex gap-2">
            {zipProcess.isCompleted ? (
              zipProcess.downloadUrls && zipProcess.downloadUrls.length > 0 ? (
                <DownloadUrlsPopover urls={zipProcess.downloadUrls} />
              ) : (
                <PrimaryButton disabled={true} className="w-full sm:w-auto h-9 px-3 py-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </PrimaryButton>
              )
            ) : zipProcess.isFailed || zipProcess.isCancelled ? (
              <PrimaryButton
                onClick={handleGenerateZip}
                disabled={zipProcess.isPending || disabled}
                className="w-full sm:w-auto h-9 px-3 py-1.5"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </PrimaryButton>
            ) : zipProcess.isProcessing ? (
              <div className="flex gap-2">
                <PrimaryButton disabled={true} className="w-full sm:w-auto h-9 px-3 py-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </PrimaryButton>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={zipProcess.isCancelling}
                  className="h-9 px-3"
                >
                  {zipProcess.isCancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Cancel
                </Button>
              </div>
            ) : (
              <PrimaryButton
                onClick={handleGenerateZip}
                disabled={zipProcess.isPending || disabled || status.missingReferences.length > 0}
                className="w-full sm:w-auto h-9 px-3 py-1.5"
              >
                {zipProcess.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    Generate
                  </>
                )}
              </PrimaryButton>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DownloadUrlsPopover({ urls }: { urls: DownloadUrl[] }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }


  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <PrimaryButton className="w-full sm:w-auto h-9 px-3 py-1.5">
          <Download className="h-4 w-4" />
          Download
        </PrimaryButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 overflow-visible">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Download Zip Files</h4>
          <div className="space-y-1">
            {urls.map((url) => {
              const filename =
                url.competitionClassName + "-" + url.minReference + "-" + url.maxReference + ".zip"
              return (
                <button
                  key={url.zipKey}
                  onClick={() => {
                    handleDownload(url.downloadUrl, filename)
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted transition-colors"
                >
                  <FileArchive className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate flex-1 text-left">{url.competitionClassName}</span>
                  <span className="text-xs text-muted-foreground">
                    #{url.minReference}-{url.maxReference}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function StatusDisplay({
  domain,
  status,
}: {
  domain: string
  status: {
    totalParticipants: number
    withZippedSubmissions: number
    missingReferences: string[]
  }
}) {
  if (status.totalParticipants === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span>No participants found for this marathon.</span>
      </div>
    )
  }

  const missingCount = status.missingReferences.length
  const hasAllZips = missingCount === 0

  if (hasAllZips) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle className="h-4 w-4" />
        <span>
          All {status.totalParticipants.toLocaleString()} participants have zipped submissions.
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {status.withZippedSubmissions.toLocaleString()} /{" "}
          {status.totalParticipants.toLocaleString()} participants have zipped submissions.
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{missingCount.toLocaleString()} missing: </span>
        {missingCount <= 3 ? (
          <div className="flex gap-1">
            {status.missingReferences.map((ref) => (
              <Link
                key={ref}
                href={formatDomainPathname("/admin/dashboard/submissions/" + ref, domain)}
                className="font-mono text-amber-700 dark:text-amber-400 hover:underline"
              >
                #{ref}
              </Link>
            ))}
          </div>
        ) : missingCount <= 8 ? (
          <div className="flex gap-1 flex-wrap">
            {status.missingReferences.slice(0, 8).map((ref) => (
              <Link
                key={ref}
                href={formatDomainPathname("/admin/dashboard/submissions/" + ref, domain)}
                className="font-mono text-amber-700 dark:text-amber-400 hover:underline"
              >
                #{ref}
              </Link>
            ))}
          </div>
        ) : (
          <MissingParticipantsPopover domain={domain} references={status.missingReferences} />
        )}
      </div>
    </div>
  )
}

function MissingParticipantsPopover({
  domain,
  references,
}: {
  domain: string
  references: string[]
}) {
  const displayCount = 12
  const visibleRefs = references.slice(0, displayCount)
  const remainingCount = references.length - displayCount

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1">
          <span>
            {visibleRefs.map((r) => "#" + r).join(", ")}
            {remainingCount > 0 && " +" + remainingCount + " more"}
          </span>
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 overflow-y-auto w-64">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Missing Participants</h4>
          <div className="grid grid-cols-2 gap-1">
            {references.map((ref) => (
              <Link
                key={ref}
                href={formatDomainPathname("/admin/dashboard/submissions/" + ref, domain)}
                className="text-xs font-mono text-amber-700 dark:text-amber-400 hover:underline p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30"
              >
                #{ref}
              </Link>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ProgressDisplay({ progress, percentage }: { progress: ProgressData; percentage: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {progress.status === "processing" || progress.status === "initializing" ? (
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          ) : progress.status === "completed" ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          ) : progress.status === "cancelled" ? (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <span className="capitalize">{progress.status}</span>
        </div>
        <span className="text-muted-foreground">{percentage}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-all duration-300",
            progress.status === "failed"
              ? "bg-red-500"
              : progress.status === "cancelled"
                ? "bg-muted-foreground"
                : "bg-violet-600"
          )}
          style={{ width: percentage + "%" }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {progress.completedChunks.toLocaleString()} / {progress.totalChunks.toLocaleString()}{" "}
          chunks
        </span>
        {progress.failedChunks > 0 && (
          <span className="text-red-600">{progress.failedChunks.toLocaleString()} failed</span>
        )}
      </div>
      {progress.competitionClasses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {progress.competitionClasses.map((cc) => (
            <Badge key={cc.competitionClassName} variant="secondary" className="text-xs">
              {cc.competitionClassName}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
