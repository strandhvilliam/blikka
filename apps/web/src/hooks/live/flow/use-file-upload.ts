"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { useMutation } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { uploadFileToPresignedUrl } from "@/lib/upload-client"
import { useUploadStore, selectFailedFiles } from "@/lib/flow/upload-store"
import { resolveSelectedImageContentType } from "@/lib/file-processing"
import type { PhotoWithPresignedUrl, UploadFileState, UploadPhase } from "@/lib/flow/types"
import { UPLOAD_PHASE } from "@/lib/flow/types"
import {
  UPLOAD_TIMEOUT_MS,
  UPLOAD_CONCURRENCY_LIMIT,
} from "@/lib/flow/constants"
import { chunk } from "@/lib/flow/utils"
import { captureByCameraS3UploadFailed } from "@/lib/sentry-by-camera"
import { useDomain } from "@/lib/domain-provider"
import { useUploadFlowState } from "@/hooks/live/flow/use-upload-flow-state"
import { useUploadFinalization } from "@/hooks/live/flow/use-upload-finalization"
import { useUploadProcessingReconciliation } from "@/hooks/live/flow/use-upload-processing-reconciliation"

export function useFileUpload() {
  const trpc = useTRPC()
  const domain = useDomain()
  const { uploadFlowState } = useUploadFlowState()
  const reference = uploadFlowState.participantRef ?? ""

  const files = useUploadStore((state) => state.files)
  const isUploading = useUploadStore((state) => state.isUploading)
  const initializeFiles = useUploadStore((state) => state.initializeFiles)
  const updateFilePhase = useUploadStore((state) => state.updateFilePhase)
  const updateFileUploadTarget = useUploadStore((state) => state.updateFileUploadTarget)
  const setFileError = useUploadStore((state) => state.setFileError)
  const clearFiles = useUploadStore((state) => state.clearFiles)
  const setIsUploading = useUploadStore((state) => state.setIsUploading)
  const lockFile = useUploadStore((state) => state.lockFile)
  const unlockFile = useUploadStore((state) => state.unlockFile)
  const isFileLocked = useUploadStore((state) => state.isFileLocked)

  const fileList = Array.from(files.values())

  const failedFiles = fileList.filter((file) => file.phase === UPLOAD_PHASE.ERROR)
  const allFilesUploaded =
    fileList.length > 0 && fileList.every((file) => file.phase === UPLOAD_PHASE.UPLOADED)

  const {
    finalizationState,
    participantStatus,
    minimumProgressDisplayReached,
    resetUploadLifecycle,
    markUploadUiStartedNow,
    markFinalizationUploading,
  } = useUploadFinalization({ domain, reference })

  useUploadProcessingReconciliation({ domain, reference })

  const { mutateAsync: refreshPresignedUploads } = useMutation(
    trpc.uploadFlow.refreshPresignedUploads.mutationOptions(),
  )

  const uploadSingleFile = useCallback(
    async (file: UploadFileState): Promise<void> => {
      if (isFileLocked(file.key)) return

      lockFile(file.key)

      try {
        updateFilePhase(file.key, UPLOAD_PHASE.UPLOADING, 0)
        const result = await uploadFileToPresignedUrl({
          file: file.file,
          presignedUrl: file.presignedUrl,
          timeoutMs: UPLOAD_TIMEOUT_MS,
          contentType: file.contentType,
        })

        if (!result.ok) {
          setFileError(file.key, result.error)
          captureByCameraS3UploadFailed(file.orderIndex, result.error, {
            submissionKey: file.key,
            file: file.file,
            requestContentType: file.contentType ?? (file.file.type || "image/jpeg"),
          })
          return
        }

        updateFilePhase(file.key, UPLOAD_PHASE.UPLOADED, 100)
      } finally {
        unlockFile(file.key)
      }
    },
    [isFileLocked, lockFile, unlockFile, updateFilePhase, setFileError],
  )

  const uploadWithConcurrency = useCallback(
    async (filesToUpload: UploadFileState[]): Promise<void> => {
      const fileChunks = chunk(filesToUpload, UPLOAD_CONCURRENCY_LIMIT)

      for (const fileChunk of fileChunks) {
        const uploadPromises = fileChunk.map(uploadSingleFile)
        await Promise.allSettled(uploadPromises)
      }
    },
    [uploadSingleFile],
  )

  const executeUpload = useCallback(
    async (photos: PhotoWithPresignedUrl[]): Promise<void> => {
      resetUploadLifecycle()
      markUploadUiStartedNow()
      initializeFiles(photos)

      const filesToUpload: UploadFileState[] = photos.map((photo) => ({
        key: photo.key,
        orderIndex: photo.orderIndex,
        file: photo.file,
        presignedUrl: photo.presignedUrl,
        preview: photo.preview,
        contentType: photo.contentType,
        phase: UPLOAD_PHASE.PRESIGNED as UploadPhase,
        progress: 0,
      }))

      await uploadWithConcurrency(filesToUpload)
    },
    [initializeFiles, markUploadUiStartedNow, resetUploadLifecycle, uploadWithConcurrency],
  )

  const retryFailedFiles = useCallback(async (): Promise<void> => {
    const failedFiles = selectFailedFiles(useUploadStore.getState()).filter(
      (file) => file.error?.retriable !== false,
    )
    if (failedFiles.length === 0) return

    if (reference) {
      let refreshedUploads: Awaited<ReturnType<typeof refreshPresignedUploads>>
      try {
        refreshedUploads = await refreshPresignedUploads({
          domain,
          reference,
          orderIndexes: failedFiles.map((file) => file.orderIndex),
          uploadContentTypes: failedFiles.map(
            (file) =>
              file.contentType ?? resolveSelectedImageContentType(file.file) ?? "image/jpeg",
          ),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toast.error(message)
        return
      }

      const refreshedUploadByKey = new Map(
        refreshedUploads.map((upload) => [upload.key, upload] as const),
      )

      failedFiles.forEach((file) => {
        const refreshedUpload = refreshedUploadByKey.get(file.key)
        if (!refreshedUpload || isFileLocked(file.key)) {
          return
        }

        updateFileUploadTarget(file.key, {
          presignedUrl: refreshedUpload.url,
          contentType: refreshedUpload.contentType,
        })
      })
    }

    failedFiles.forEach((file) => {
      if (!isFileLocked(file.key)) {
        updateFilePhase(file.key, UPLOAD_PHASE.PRESIGNED, 0)
      }
    })

    markFinalizationUploading()

    const filesToRetry = failedFiles
      .map((file) => useUploadStore.getState().files.get(file.key) ?? file)
      .filter((file) => !isFileLocked(file.key))
    await uploadWithConcurrency(filesToRetry)
  }, [
    domain,
    isFileLocked,
    markFinalizationUploading,
    reference,
    refreshPresignedUploads,
    updateFilePhase,
    updateFileUploadTarget,
    uploadWithConcurrency,
  ])

  const clearUploadFiles = useCallback(() => {
    resetUploadLifecycle()
    clearFiles()
  }, [clearFiles, resetUploadLifecycle])

  return {
    isUploading,
    files: fileList,
    failedFiles,
    allFilesUploaded,
    minimumProgressDisplayReached,
    finalizationState,
    participantStatus,
    participantReference: reference,
    executeUpload,
    retryFailedFiles,
    clearFiles: clearUploadFiles,
    setIsUploading,
  }
}
