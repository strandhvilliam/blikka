"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { cn } from "@/lib/utils"
import { Archive, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Button } from "@/components/ui/button"
import { useZipDownloadProcess } from "../_lib/use-zip-download-process"
import { StatusDisplay } from "./status-display"
import { ProgressDisplay } from "./progress-display"
import { DownloadUrlsPopover } from "./download-urls-popover"

export type {
  ProgressData,
  DownloadUrl,
  ZipSubmissionStatus,
} from "../_lib/types"
export { useZipDownloadProcess } from "../_lib/use-zip-download-process"
export { StatusDisplay } from "./status-display"
export { ProgressDisplay } from "./progress-display"
export { DownloadUrlsPopover } from "./download-urls-popover"

interface FullMarathonZipCardProps {
  disabled?: boolean
}

export function FullMarathonZipCard({ disabled }: FullMarathonZipCardProps) {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: status } = useSuspenseQuery(
    trpc.zipFiles.getZipSubmissionStatus.queryOptions({ domain }),
  )

  const zipProcess = useZipDownloadProcess(domain)

  const handleGenerateZip = async () => {
    try {
      await zipProcess.actions.start()
    } catch (error) {
      toast.error("Failed to start zip generation", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      })
    }
  }

  const handleCancel = async () => {
    try {
      await zipProcess.actions.cancel()
    } catch (error) {
      toast.error("Failed to cancel", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      })
    }
  }

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-white transition-shadow duration-200",
        disabled
          ? "border-border/60 opacity-60 cursor-not-allowed"
          : "border-border hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]"
      )}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground/60">
          <Archive className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground/70">
                Full Marathon Zip
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                Generate a complete zip archive of all participant submissions.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              ZIP
            </span>
          </div>
        </div>
      </div>

      <div className="mx-5 mb-5 pt-4 border-t border-border/50 space-y-4">
        <StatusDisplay domain={domain} status={status} />

        {zipProcess.isProcessing && zipProcess.progress && (
          <ProgressDisplay
            progress={zipProcess.progress}
            percentage={zipProcess.completionPercentage}
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground/70">
            {zipProcess.isProcessing
              ? "Generating zip files. This may take several minutes."
              : "All participants must have zipped submissions before generating."}
          </p>
          <div className="flex gap-2 shrink-0">
            {zipProcess.isCompleted ? (
              zipProcess.downloadUrls && zipProcess.downloadUrls.length > 0 ? (
                <DownloadUrlsPopover urls={zipProcess.downloadUrls} />
              ) : (
                <PrimaryButton disabled className="h-8 px-3 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </PrimaryButton>
              )
            ) : zipProcess.isFailed || zipProcess.isCancelled ? (
              <PrimaryButton
                onClick={handleGenerateZip}
                disabled={zipProcess.isPending || disabled}
                className="h-8 px-3 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </PrimaryButton>
            ) : zipProcess.isProcessing ? (
              <>
                <PrimaryButton disabled className="h-8 px-3 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing…
                </PrimaryButton>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={zipProcess.isCancelling}
                  className="h-8 px-3 text-xs"
                >
                  {zipProcess.isCancelling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Cancel
                </Button>
              </>
            ) : (
              <PrimaryButton
                onClick={handleGenerateZip}
                disabled={
                  zipProcess.isPending ||
                  disabled ||
                  status.missingReferences.length > 0
                }
                className="h-8 px-3 text-xs"
              >
                {zipProcess.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5" />
                    Generate
                  </>
                )}
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
