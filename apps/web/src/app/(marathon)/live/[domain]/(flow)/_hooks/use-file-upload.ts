"use client";

import { useCallback, useEffect } from "react";
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
  POLLING_INTERVAL_MS,
} from "../_lib/constants";
import { chunk } from "../_lib/utils";

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

  const orderIndexes =
    activeByCameraOrderIndex || activeByCameraOrderIndex === 0
      ? [activeByCameraOrderIndex]
      : Array.from(files.values()).map((f) => f.orderIndex);

  const { data: uploadStatus } = useQuery(
    trpc.uploadFlow.getUploadStatus.queryOptions(
      { domain, reference, orderIndexes },
      {
        enabled: isUploading && orderIndexes.length > 0 && !!reference,
        refetchInterval: POLLING_INTERVAL_MS,
        refetchIntervalInBackground: false,
      },
    ),
  );

  useEffect(() => {
    if (!uploadStatus || !isUploading) return;

    uploadStatus.submissions.forEach((submission) => {
      const file = files.get(submission.key);
      if (!file) return;

      // Skip if file is locked (being uploaded)
      if (isFileLocked(submission.key)) return;

      if (submission.uploaded && file.phase !== UPLOAD_PHASE.COMPLETED) {
        updateFilePhase(submission.key, UPLOAD_PHASE.COMPLETED);
      }
    });

    if (uploadStatus.participant?.finalized) {
      const allFiles = Array.from(files.values());
      const allFilesCompleted = allFiles.every(
        (f) => f.phase === UPLOAD_PHASE.COMPLETED,
      );
      if (allFilesCompleted) {
        onAllCompleted?.();
      }
    }
  }, [
    uploadStatus,
    isUploading,
    files,
    isFileLocked,
    updateFilePhase,
    onAllCompleted,
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
    [initializeFiles, uploadWithConcurrency],
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

  return {
    isUploading,
    files: selectAllFiles(useUploadStore.getState()),
    failedFiles: selectFailedFiles(useUploadStore.getState()),
    uploadStatus,
    executeUpload,
    retryFailedFiles,
    clearFiles,
    setIsUploading,
  };
}
