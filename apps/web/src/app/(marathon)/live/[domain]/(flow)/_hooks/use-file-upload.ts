"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { uploadFileToPresignedUrl } from "@/lib/upload-client"
import { useUploadStore, selectFailedFiles } from "../_lib/upload-store"
import type {
  FinalizationState,
  PhotoWithPresignedUrl,
  UploadFileState,
  UploadPhase,
} from "../_lib/types"
import { FINALIZATION_STATE, UPLOAD_PHASE } from "../_lib/types"
import {
  MIN_UPLOAD_PROGRESS_DISPLAY_MS,
  PARTICIPANT_FINALIZATION_POLL_INTERVAL_MS,
  PARTICIPANT_FINALIZATION_TIMEOUT_MS,
  UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS,
  UPLOAD_FLOW_STATUS_QUERY_RETRY_COUNT,
  UPLOAD_TIMEOUT_MS,
  UPLOAD_CONCURRENCY_LIMIT,
  UPLOAD_STATUS_RECONCILIATION_INTERVAL_MS,
} from "../_lib/constants"
import { chunk } from "../_lib/utils"
import { useUploadStatusRealtime } from "@/lib/participant-upload/use-upload-status-realtime"

interface UseFileUploadOptions {
  domain: string
  reference: string
}

export function useFileUpload({ domain, reference }: UseFileUploadOptions) {
  const trpc = useTRPC()
  const [finalizationState, setFinalizationState] = useState<FinalizationState>(
    FINALIZATION_STATE.IDLE,
  )
  const [participantStatus, setParticipantStatus] = useState<string | null>(null)
  const [uploadUiStartedAt, setUploadUiStartedAt] = useState<number | null>(null)
  const [minimumProgressDisplayReached, setMinimumProgressDisplayReached] = useState(false)
  const [finalizationStartedAt, setFinalizationStartedAt] = useState<number | null>(null)

  const files = useUploadStore((state) => state.files)
  const isUploading = useUploadStore((state) => state.isUploading)
  const initializeFiles = useUploadStore((state) => state.initializeFiles)
  const updateFilePhase = useUploadStore((state) => state.updateFilePhase)
  const setFileProcessingComplete = useUploadStore((state) => state.setFileProcessingComplete)
  const setFileError = useUploadStore((state) => state.setFileError)
  const clearFiles = useUploadStore((state) => state.clearFiles)
  const setIsUploading = useUploadStore((state) => state.setIsUploading)
  const lockFile = useUploadStore((state) => state.lockFile)
  const unlockFile = useUploadStore((state) => state.unlockFile)
  const isFileLocked = useUploadStore((state) => state.isFileLocked)
  const filesRef = useRef(files)

  useEffect(() => {
    filesRef.current = files
  }, [files])

  const resetUploadLifecycle = useCallback(() => {
    setFinalizationState(FINALIZATION_STATE.IDLE)
    setParticipantStatus(null)
    setUploadUiStartedAt(null)
    setMinimumProgressDisplayReached(false)
    setFinalizationStartedAt(null)
  }, [])

  useEffect(() => {
    if (!isUploading) {
      resetUploadLifecycle()
    }
  }, [isUploading, resetUploadLifecycle])

  const fileList = Array.from(files.values())
  const orderIndexes = fileList.map((file) => file.orderIndex)

  const failedFiles = fileList.filter((file) => file.phase === UPLOAD_PHASE.ERROR)
  const allFilesUploaded =
    fileList.length > 0 && fileList.every((file) => file.phase === UPLOAD_PHASE.UPLOADED)

  const participantIsReady = participantStatus === "completed" || participantStatus === "verified"

  useEffect(() => {
    if (!isUploading || fileList.length === 0) return

    if (participantIsReady) {
      setFinalizationState(FINALIZATION_STATE.READY)
      return
    }

    if (allFilesUploaded) {
      setFinalizationState((current) =>
        current === FINALIZATION_STATE.TIMEOUT_BLOCKED ? current : FINALIZATION_STATE.FINALIZING,
      )
      return
    }

    setFinalizationState(FINALIZATION_STATE.UPLOADING)
  }, [allFilesUploaded, fileList.length, isUploading, participantIsReady])

  useEffect(() => {
    if (finalizationState !== FINALIZATION_STATE.FINALIZING) {
      if (!allFilesUploaded) {
        setFinalizationStartedAt(null)
      }
      return
    }

    setFinalizationStartedAt((current) => current ?? Date.now())
  }, [allFilesUploaded, finalizationState])

  useEffect(() => {
    if (finalizationState !== FINALIZATION_STATE.FINALIZING || finalizationStartedAt === null)
      return
    const remainingTime = PARTICIPANT_FINALIZATION_TIMEOUT_MS - (Date.now() - finalizationStartedAt)

    if (remainingTime <= 0) {
      setFinalizationState(FINALIZATION_STATE.TIMEOUT_BLOCKED)
      return
    }

    const timeout = window.setTimeout(() => {
      setFinalizationState((current) =>
        current === FINALIZATION_STATE.FINALIZING ? FINALIZATION_STATE.TIMEOUT_BLOCKED : current,
      )
    }, remainingTime)

    return () => window.clearTimeout(timeout)
  }, [finalizationStartedAt, finalizationState])

  useEffect(() => {
    if (!isUploading || uploadUiStartedAt === null) return

    const remainingTime = MIN_UPLOAD_PROGRESS_DISPLAY_MS - (Date.now() - uploadUiStartedAt)

    if (remainingTime <= 0) {
      setMinimumProgressDisplayReached(true)
      return
    }

    const timeout = window.setTimeout(() => {
      setMinimumProgressDisplayReached(true)
    }, remainingTime)

    return () => window.clearTimeout(timeout)
  }, [isUploading, uploadUiStartedAt])

  const participantQueryEnabled =
    isUploading &&
    allFilesUploaded &&
    !!reference &&
    (finalizationState === FINALIZATION_STATE.FINALIZING ||
      finalizationState === FINALIZATION_STATE.TIMEOUT_BLOCKED)

  const { data: participant } = useQuery(
    trpc.participants.getPublicParticipantByReference.queryOptions(
      {
        domain,
        reference,
      },
      {
        enabled: participantQueryEnabled,
        refetchInterval: participantQueryEnabled
          ? PARTICIPANT_FINALIZATION_POLL_INTERVAL_MS
          : false,
        refetchIntervalInBackground: true,
        retry: UPLOAD_FLOW_STATUS_QUERY_RETRY_COUNT,
        retryDelay: (attemptIndex) =>
          Math.min(
            1000 * 2 ** attemptIndex,
            UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS,
          ),
      },
    ),
  )

  useEffect(() => {
    if (!participant) {
      return
    }

    setParticipantStatus(participant.status)
  }, [participant])

  const processingStatusEnabled = isUploading && !!reference && orderIndexes.length > 0

  const { data: uploadStatus, refetch: refetchUploadStatus } = useQuery(
    trpc.uploadFlow.getUploadStatus.queryOptions(
      {
        domain,
        reference,
        orderIndexes,
      },
      {
        enabled: processingStatusEnabled,
        refetchInterval: processingStatusEnabled ? UPLOAD_STATUS_RECONCILIATION_INTERVAL_MS : false,
        refetchIntervalInBackground: true,
        retry: UPLOAD_FLOW_STATUS_QUERY_RETRY_COUNT,
        retryDelay: (attemptIndex) =>
          Math.min(
            1000 * 2 ** attemptIndex,
            UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS,
          ),
      },
    ),
  )

  const markFileProcessingCompleteByOrderIndex = useCallback(
    (orderIndex: number | null | undefined) => {
      if (orderIndex === null || orderIndex === undefined) return false

      const file = Array.from(filesRef.current.values()).find(
        (candidate) => candidate.orderIndex === orderIndex,
      )
      if (!file) return false

      setFileProcessingComplete(file.key)
      return true
    },
    [setFileProcessingComplete],
  )

  const markFileProcessingCompleteByKey = useCallback(
    (key: string) => {
      const file = filesRef.current.get(key)
      if (!file) return false

      setFileProcessingComplete(key)
      return true
    },
    [setFileProcessingComplete],
  )

  useUploadStatusRealtime({
    domain,
    reference,
    enabled: processingStatusEnabled,
    onSubmissionProcessed: ({ orderIndex }) => {
      const handled = markFileProcessingCompleteByOrderIndex(orderIndex)
      if (!handled) {
        void refetchUploadStatus()
      }
    },
    onParticipantFinalized: () => {
      fileList.forEach((file) => {
        if (file.phase === UPLOAD_PHASE.UPLOADED) {
          setFileProcessingComplete(file.key)
        }
      })
    },
    onEventError: () => {
      void refetchUploadStatus()
    },
  })

  useEffect(() => {
    if (!uploadStatus) return

    uploadStatus.submissions.forEach((submission) => {
      if (submission.exifProcessed || submission.thumbnailKey !== null) {
        markFileProcessingCompleteByKey(submission.key)
      }
    })
  }, [markFileProcessingCompleteByKey, uploadStatus])

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
      setUploadUiStartedAt(Date.now())
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
    [initializeFiles, resetUploadLifecycle, uploadWithConcurrency],
  )

  const retryFailedFiles = useCallback(async (): Promise<void> => {
    const failedFiles = selectFailedFiles(useUploadStore.getState())
    if (failedFiles.length === 0) return

    failedFiles.forEach((file) => {
      if (!isFileLocked(file.key)) {
        updateFilePhase(file.key, UPLOAD_PHASE.PRESIGNED, 0)
      }
    })

    setFinalizationState(FINALIZATION_STATE.UPLOADING)

    const filesToRetry = failedFiles.filter((f) => !isFileLocked(f.key))
    await uploadWithConcurrency(filesToRetry)
  }, [isFileLocked, updateFilePhase, uploadWithConcurrency])

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
