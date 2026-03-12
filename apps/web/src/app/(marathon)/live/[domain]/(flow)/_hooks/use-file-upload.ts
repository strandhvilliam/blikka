"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { uploadFileToPresignedUrl } from "@/lib/upload-client";
import {
  useUploadStore,
  selectFailedFiles,
  selectAllFiles,
} from "../_lib/upload-store";
import type {
  PhotoWithPresignedUrl,
  UploadFileState,
  UploadPhase,
} from "../_lib/types";
import { UPLOAD_PHASE } from "../_lib/types";
import {
  UPLOAD_TIMEOUT_MS,
  UPLOAD_CONCURRENCY_LIMIT,
  UPLOAD_STATUS_RECONCILIATION_INTERVAL_MS,
} from "../_lib/constants";
import {
  getPollingCompletionKeys,
  getRealtimeSubmissionCompletion,
  shouldCompleteUploadFlow,
  shouldReconcileUploadStatus,
  type UploadRealtimeFileSnapshot,
} from "../_lib/upload-status-realtime";
import { chunk } from "../_lib/utils";
import { useUploadStatusRealtime } from "./use-upload-status-realtime";

interface UseFileUploadOptions {
  domain: string;
  reference: string;
  onAllCompleted?: () => void;
  activeByCameraOrderIndex?: number;
}

export function useFileUpload({
  domain,
  reference,
  onAllCompleted,
  activeByCameraOrderIndex,
}: UseFileUploadOptions) {
  const trpc = useTRPC();
  const [isCompletionHandled, setIsCompletionHandled] = useState(false);

  const files = useUploadStore((state) => state.files);
  const isUploading = useUploadStore((state) => state.isUploading);
  const initializeFiles = useUploadStore((state) => state.initializeFiles);
  const updateFilePhase = useUploadStore((state) => state.updateFilePhase);
  const setFileError = useUploadStore((state) => state.setFileError);
  const clearFiles = useUploadStore((state) => state.clearFiles);
  const setIsUploading = useUploadStore((state) => state.setIsUploading);
  const lockFile = useUploadStore((state) => state.lockFile);
  const unlockFile = useUploadStore((state) => state.unlockFile);
  const isFileLocked = useUploadStore((state) => state.isFileLocked);
  const filesRef = useRef(files);
  const completionHandledRef = useRef(false);
  const participantFinalizedRef = useRef(false);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const resetCompletionTracking = useCallback(() => {
    completionHandledRef.current = false;
    participantFinalizedRef.current = false;
    setIsCompletionHandled(false);
  }, []);

  useEffect(() => {
    if (!isUploading) {
      resetCompletionTracking();
    }
  }, [isUploading, resetCompletionTracking]);

  const orderIndexes = useMemo(
    () =>
      activeByCameraOrderIndex || activeByCameraOrderIndex === 0
        ? [activeByCameraOrderIndex]
        : Array.from(files.values()).map((f) => f.orderIndex),
    [activeByCameraOrderIndex, files],
  );

  const getFileSnapshots = useCallback(
    (): UploadRealtimeFileSnapshot[] =>
      Array.from(filesRef.current.values()).map((file) => ({
        key: file.key,
        orderIndex: file.orderIndex,
        phase: file.phase,
      })),
    [],
  );

  const handleAllCompleted = useCallback(() => {
    if (completionHandledRef.current) {
      return;
    }

    completionHandledRef.current = true;
    setIsCompletionHandled(true);
    onAllCompleted?.();
  }, [onAllCompleted]);

  const maybeHandleCompletion = useCallback(
    (participantFinalized: boolean) => {
      if (
        !shouldCompleteUploadFlow(
          getFileSnapshots(),
          participantFinalized,
          UPLOAD_PHASE.COMPLETED,
        )
      ) {
        return false;
      }

      handleAllCompleted();
      return true;
    },
    [getFileSnapshots, handleAllCompleted],
  );

  useEffect(() => {
    if (!isUploading || completionHandledRef.current) {
      return;
    }

    if (participantFinalizedRef.current) {
      maybeHandleCompletion(true);
    }
  }, [files, isUploading, maybeHandleCompletion]);

  const markFileCompletedByKey = useCallback(
    (key: string) => {
      const file = filesRef.current.get(key);
      if (!file || file.phase === UPLOAD_PHASE.COMPLETED) {
        return Boolean(file);
      }

      updateFilePhase(key, UPLOAD_PHASE.COMPLETED, 100);
      return true;
    },
    [updateFilePhase],
  );

  const markFileCompletedByOrderIndex = useCallback(
    (orderIndex: number | null | undefined) => {
      const completion = getRealtimeSubmissionCompletion(
        getFileSnapshots(),
        orderIndex,
        UPLOAD_PHASE.COMPLETED,
      );
      if (!completion) {
        return false;
      }

      if (completion.shouldUpdate) {
        updateFilePhase(completion.key, UPLOAD_PHASE.COMPLETED, 100);
      }

      return true;
    },
    [getFileSnapshots, updateFilePhase],
  );

  const { data: uploadStatus, refetch: refetchUploadStatus } = useQuery(
    trpc.uploadFlow.getUploadStatus.queryOptions(
      { domain, reference, orderIndexes },
      {
        enabled: isUploading && orderIndexes.length > 0 && !!reference,
        refetchInterval:
          isUploading &&
          orderIndexes.length > 0 &&
          !!reference &&
          !isCompletionHandled
            ? UPLOAD_STATUS_RECONCILIATION_INTERVAL_MS
            : false,
        refetchIntervalInBackground: false,
      },
    ),
  );

  useUploadStatusRealtime({
    domain,
    reference,
    enabled: isUploading && !!reference,
    onSubmissionProcessed: ({ orderIndex }) => {
      const wasHandled = markFileCompletedByOrderIndex(orderIndex);
      if (!wasHandled) {
        void refetchUploadStatus();
        return;
      }

      if (participantFinalizedRef.current) {
        maybeHandleCompletion(true);
      }
    },
    onParticipantFinalized: () => {
      participantFinalizedRef.current = true;
      if (!maybeHandleCompletion(true)) {
        void refetchUploadStatus();
      }
    },
    onEventError: (_event, data) => {
      if (shouldReconcileUploadStatus(data.outcome)) {
        void refetchUploadStatus();
      }
    },
  });

  useEffect(() => {
    if (!uploadStatus || !isUploading) return;

    const keysToComplete = getPollingCompletionKeys(
      getFileSnapshots(),
      uploadStatus.submissions,
      UPLOAD_PHASE.COMPLETED,
    );

    keysToComplete.forEach((key) => {
      if (!isFileLocked(key)) {
        markFileCompletedByKey(key);
      }
    });

    if (uploadStatus.participant?.finalized) {
      participantFinalizedRef.current = true;
      maybeHandleCompletion(true);
    }
  }, [
    uploadStatus,
    isUploading,
    isFileLocked,
    getFileSnapshots,
    markFileCompletedByKey,
    maybeHandleCompletion,
  ]);

  const uploadSingleFile = useCallback(
    async (file: UploadFileState): Promise<void> => {
      if (isFileLocked(file.key)) {
        return;
      }

      lockFile(file.key);

      try {
        updateFilePhase(file.key, UPLOAD_PHASE.UPLOADING, 0);
        const result = await uploadFileToPresignedUrl({
          file: file.file,
          presignedUrl: file.presignedUrl,
          timeoutMs: UPLOAD_TIMEOUT_MS,
        });

        if (!result.ok) {
          setFileError(file.key, result.error);
          return;
        }

        // Mark as processing - server will update to completed
        updateFilePhase(file.key, UPLOAD_PHASE.PROCESSING, 100);
      } finally {
        unlockFile(file.key);
      }
    },
    [isFileLocked, lockFile, unlockFile, updateFilePhase, setFileError],
  );

  const uploadWithConcurrency = useCallback(
    async (filesToUpload: UploadFileState[]): Promise<void> => {
      const fileChunks = chunk(filesToUpload, UPLOAD_CONCURRENCY_LIMIT);

      for (const fileChunk of fileChunks) {
        const uploadPromises = fileChunk.map(uploadSingleFile);
        await Promise.allSettled(uploadPromises);
      }
    },
    [uploadSingleFile],
  );

  const executeUpload = useCallback(
    async (photos: PhotoWithPresignedUrl[]): Promise<void> => {
      resetCompletionTracking();
      initializeFiles(photos);

      const filesToUpload = photos
        .map((photo) => ({
          key: photo.key,
          orderIndex: photo.orderIndex,
          file: photo.file,
          presignedUrl: photo.presignedUrl,
          preview: photo.preview,
          phase: UPLOAD_PHASE.PRESIGNED as UploadPhase,
          progress: 0,
        }))
        .filter((file): file is UploadFileState => file !== undefined);

      await uploadWithConcurrency(filesToUpload);
    },
    [initializeFiles, resetCompletionTracking, uploadWithConcurrency],
  );

  const retryFailedFiles = useCallback(async (): Promise<void> => {
    const failedFiles = selectFailedFiles(useUploadStore.getState());
    if (failedFiles.length === 0) return;

    failedFiles.forEach((file) => {
      if (!isFileLocked(file.key)) {
        updateFilePhase(file.key, UPLOAD_PHASE.PRESIGNED, 0);
      }
    });

    const filesToRetry = failedFiles.filter((f) => !isFileLocked(f.key));
    await uploadWithConcurrency(filesToRetry);
  }, [isFileLocked, updateFilePhase, uploadWithConcurrency]);

  const clearUploadFiles = useCallback(() => {
    resetCompletionTracking();
    clearFiles();
  }, [clearFiles, resetCompletionTracking]);

  return {
    isUploading,
    files: selectAllFiles(useUploadStore.getState()),
    failedFiles: selectFailedFiles(useUploadStore.getState()),
    uploadStatus,
    executeUpload,
    retryFailedFiles,
    clearFiles: clearUploadFiles,
    setIsUploading,
  };
}
