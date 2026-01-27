"use client";

import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useUploadContext } from "../_lib/upload-context";
import type { PhotoWithPresignedUrl, UploadFileState, UploadPhase } from "../_lib/types";
import { UPLOAD_PHASE, classifyUploadError } from "../_lib/types";

const UPLOAD_TIMEOUT_MS = 1000 * 60 * 6; // 6 minutes
const UPLOAD_CONCURRENCY_LIMIT = 1;
const POLLING_INTERVAL_MS = 3000; // 3 seconds

// Utility to chunk array for controlled concurrency
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

interface UseFileUploadOptions {
  domain: string;
  reference: string;
  onAllCompleted?: () => void;
}

export function useFileUpload({
  domain,
  reference,
  onAllCompleted,
}: UseFileUploadOptions) {
  const trpc = useTRPC();
  const {
    files,
    isUploading,
    initializeFiles,
    updateFilePhase,
    setFileError,
    clearFiles,
    setIsUploading,
    lockFile,
    unlockFile,
    isFileLocked,
    getFile,
    getAllFiles,
    getFailedFiles,
  } = useUploadContext();

  // Get order indexes for polling
  const orderIndexes = Array.from(files.values()).map((f) => f.orderIndex);

  // Poll for upload status
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

  // Update file phases based on polling response
  useEffect(() => {
    if (!uploadStatus || !isUploading) return;

    uploadStatus.submissions.forEach((submission) => {
      const file = getFile(submission.key);
      if (!file) return;

      // Skip if file is locked (being uploaded)
      if (isFileLocked(submission.key)) return;

      // Update to completed if uploaded on server
      if (
        submission.uploaded &&
        file.phase !== UPLOAD_PHASE.COMPLETED
      ) {
        updateFilePhase(submission.key, UPLOAD_PHASE.COMPLETED);
      }
    });

    // Check if all completed and finalized
    if (uploadStatus.participant?.finalized) {
      const allFilesCompleted = getAllFiles().every(
        (f) => f.phase === UPLOAD_PHASE.COMPLETED,
      );
      if (allFilesCompleted) {
        onAllCompleted?.();
      }
    }
  }, [
    uploadStatus,
    isUploading,
    getFile,
    isFileLocked,
    updateFilePhase,
    getAllFiles,
    onAllCompleted,
  ]);

  // Upload a single file
  const uploadSingleFile = useCallback(
    async (file: UploadFileState): Promise<void> => {
      if (isFileLocked(file.key)) {
        return;
      }

      lockFile(file.key);

      try {
        updateFilePhase(file.key, UPLOAD_PHASE.UPLOADING, 0);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, UPLOAD_TIMEOUT_MS);

        try {
          const response = await fetch(file.presignedUrl, {
            method: "PUT",
            body: file.file,
            signal: controller.signal,
            headers: {
              // Use actual file type instead of hardcoded (fix from review)
              "Content-Type": file.file.type || "image/jpeg",
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const error = new Error(
              `Upload failed: ${response.status} ${response.statusText}`,
            );
            const code = classifyUploadError(error, response.status);

            setFileError(file.key, {
              message: error.message,
              code,
              timestamp: new Date(),
              httpStatus: response.status,
            });
            return;
          }

          // Mark as processing - server will update to completed
          updateFilePhase(file.key, UPLOAD_PHASE.PROCESSING, 100);
        } catch (error) {
          clearTimeout(timeoutId);

          const err =
            error instanceof Error ? error : new Error("Unknown upload error");
          const code = classifyUploadError(err);

          setFileError(file.key, {
            message: err.message,
            code,
            timestamp: new Date(),
          });
        }
      } finally {
        unlockFile(file.key);
      }
    },
    [
      isFileLocked,
      lockFile,
      unlockFile,
      updateFilePhase,
      setFileError,
    ],
  );

  // Upload with controlled concurrency
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

  // Main execute upload function
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

  // Retry failed files
  const retryFailedFiles = useCallback(async (): Promise<void> => {
    const failedFiles = getFailedFiles();
    if (failedFiles.length === 0) return;

    // Reset failed files to presigned state
    failedFiles.forEach((file) => {
      if (!isFileLocked(file.key)) {
        updateFilePhase(file.key, UPLOAD_PHASE.PRESIGNED, 0);
      }
    });

    // Get updated files and retry
    const filesToRetry = failedFiles.filter((f) => !isFileLocked(f.key));
    await uploadWithConcurrency(filesToRetry);
  }, [getFailedFiles, isFileLocked, updateFilePhase, uploadWithConcurrency]);

  return {
    isUploading,
    files: getAllFiles(),
    failedFiles: getFailedFiles(),
    uploadStatus,
    executeUpload,
    retryFailedFiles,
    clearFiles,
    setIsUploading,
  };
}
