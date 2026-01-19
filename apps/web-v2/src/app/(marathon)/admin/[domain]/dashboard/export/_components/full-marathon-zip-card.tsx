"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Archive, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Button } from "@/components/ui/button";
import { useZipDownloadProcess } from "../_lib/use-zip-download-process";
import { StatusDisplay } from "./status-display";
import { ProgressDisplay } from "./progress-display";
import { DownloadUrlsPopover } from "./download-urls-popover";

export type {
  ProgressData,
  DownloadUrl,
  ZipSubmissionStatus,
} from "../_lib/types";
export { useZipDownloadProcess } from "../_lib/use-zip-download-process";
export { StatusDisplay } from "./status-display";
export { ProgressDisplay } from "./progress-display";
export { DownloadUrlsPopover } from "./download-urls-popover";

interface FullMarathonZipCardProps {
  disabled?: boolean;
}

export function FullMarathonZipCard({ disabled }: FullMarathonZipCardProps) {
  const domain = useDomain();
  const trpc = useTRPC();

  const { data: status } = useSuspenseQuery(
    trpc.zipFiles.getZipSubmissionStatus.queryOptions({ domain }),
  );

  const zipProcess = useZipDownloadProcess(domain);

  const handleGenerateZip = async () => {
    try {
      await zipProcess.actions.start();
    } catch (error) {
      toast.error("Failed to start zip generation", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    }
  };

  const handleCancel = async () => {
    try {
      await zipProcess.actions.cancel();
    } catch (error) {
      toast.error("Failed to cancel", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    }
  };

  const accentBg = "rgba(139, 92, 246, 0.12)";

  return (
    <Card
      className={cn(
        "group relative transition-all duration-200 py-6!",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-md",
      )}
    >
      <CardHeader className="space-y-0 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                "ring-1 ring-border text-muted-foreground",
              )}
              style={{ background: accentBg }}
            >
              <Archive className="h-5 w-5 text-violet-600" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold font-rocgrotesk leading-none">
                Full Marathon Zip
              </h3>
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
                <PrimaryButton
                  disabled={true}
                  className="w-full sm:w-auto h-9 px-3 py-1.5"
                >
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
                <PrimaryButton
                  disabled={true}
                  className="w-full sm:w-auto h-9 px-3 py-1.5"
                >
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
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Cancel
                </Button>
              </div>
            ) : (
              <PrimaryButton
                onClick={handleGenerateZip}
                disabled={
                  zipProcess.isPending ||
                  disabled ||
                  status.missingReferences.length > 0
                }
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
  );
}
