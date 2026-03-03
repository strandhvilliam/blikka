"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import type { ProgressData, DownloadUrl } from "../_lib/types";

interface ZipProcessResult {
  totalChunks: number;
  processId: string;
}

interface CancelResult {
  success: boolean;
  message: string;
}

interface UseZipDownloadProcessReturn {
  progress: ProgressData | null;
  downloadUrls: DownloadUrl[] | null;
  isIdle: boolean;
  isProcessing: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isCancelled: boolean;
  isLoading: boolean;
  completionPercentage: number;
  isPending: boolean;
  isCancelling: boolean;
  actions: {
    start: () => Promise<boolean>;
    cancel: () => Promise<boolean>;
    retry: () => Promise<boolean>;
  };
}

export function useZipDownloadProcess(
  domain: string,
): UseZipDownloadProcessReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [refetchInterval, setRefetchInterval] = useState<number | false>(false);

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
      },
    ),
  );

  const processId = activeProcess?.processId ?? null;

  const { data: downloadUrls } = useQuery(
    trpc.zipFiles.getZipDownloadUrls.queryOptions(
      { domain, processId: processId ?? "" },
      {
        enabled: !!processId && activeProcess?.status === "completed",
        staleTime: 60000,
      },
    ),
  );

  const initializeMutation = useMutation(
    trpc.zipFiles.initializeZipDownloads.mutationOptions(),
  );
  const cancelMutation = useMutation(
    trpc.zipFiles.cancelDownloadProcess.mutationOptions(),
  );

  useEffect(() => {
    if (!activeProcess) {
      setRefetchInterval(false);
      return;
    }

    if (
      activeProcess.status === "initializing" ||
      activeProcess.status === "processing"
    ) {
      setRefetchInterval(2000);
    } else {
      setRefetchInterval(false);
    }
  }, [activeProcess?.status]);

  const startGeneration = async (): Promise<boolean> => {
    const result = await initializeMutation.mutateAsync({ domain });

    if ("totalChunks" in result && result.totalChunks === 0) {
      toast.info("No zipped submissions found", {
        description:
          "There are no participants with zipped submissions to process.",
      });
      return false;
    }

    if ("processId" in result) {
      toast.success("Zip generation started", {
        description: "Processing has begun. This may take several minutes.",
      });
      await refetchActiveProcess();
      setRefetchInterval(2000);
      return true;
    }

    return false;
  };

  const cancelGeneration = async (): Promise<boolean> => {
    if (!processId) return false;

    const result = await cancelMutation.mutateAsync({ domain, processId });

    if (result.success) {
      toast.info("Zip generation cancelled");
      await refetchActiveProcess();
      return true;
    } else {
      toast.error("Failed to cancel", { description: result.message });
      return false;
    }
  };

  const status = activeProcess?.status ?? null;
  const isIdle =
    !activeProcess ||
    status === "completed" ||
    status === "failed" ||
    status === "cancelled";
  const isProcessing = status === "initializing" || status === "processing";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";

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
    : null;

  const completionPercentage =
    progress && progress.totalChunks > 0
      ? Math.round(
          ((progress.completedChunks + progress.failedChunks) /
            progress.totalChunks) *
            100,
        )
      : 0;

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
  };
}
