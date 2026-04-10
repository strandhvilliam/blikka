"use client"

import { useCallback, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useUploadStore } from "@/lib/flow/upload-store"
import type { UploadFileState } from "@/lib/flow/types"
import { UPLOAD_PHASE } from "@/lib/flow/types"
import {
  UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS,
  UPLOAD_FLOW_STATUS_QUERY_RETRY_COUNT,
  UPLOAD_STATUS_RECONCILIATION_INTERVAL_MS,
} from "@/lib/flow/constants"
import { useUploadStatusRealtime } from "@/lib/use-upload-status-realtime"

interface UseUploadProcessingReconciliationOptions {
  domain: string
  reference: string
}

export function useUploadProcessingReconciliation({
  domain,
  reference,
}: UseUploadProcessingReconciliationOptions) {
  const trpc = useTRPC()
  const files = useUploadStore((state) => state.files)
  const isUploading = useUploadStore((state) => state.isUploading)
  const setFileProcessingComplete = useUploadStore((state) => state.setFileProcessingComplete)

  const filesRef = useRef<Map<string, UploadFileState>>(files)
  useEffect(() => {
    filesRef.current = files
  }, [files])

  const orderIndexes = Array.from(files.values()).map((file) => file.orderIndex)
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
          Math.min(1000 * 2 ** attemptIndex, UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS),
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
      console.log("onSubmissionProcessed", orderIndex)
      const handled = markFileProcessingCompleteByOrderIndex(orderIndex)
      if (!handled) {
        void refetchUploadStatus()
      }
    },
    onParticipantFinalized: () => {
      console.log("onParticipantFinalized")
      for (const file of filesRef.current.values()) {
        if (file.phase === UPLOAD_PHASE.UPLOADED) {
          setFileProcessingComplete(file.key)
        }
      }
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
}
