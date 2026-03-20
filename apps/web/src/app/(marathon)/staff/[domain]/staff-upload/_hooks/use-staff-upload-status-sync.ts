"use client"

import { useCallback, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTRPC } from "@/lib/trpc/client"
import {
  getPollingCompletionKeys,
  getRealtimeSubmissionCompletion,
  shouldCompleteUploadFlow,
  shouldReconcileUploadStatus,
  type UploadRealtimeFileSnapshot,
} from "@/lib/upload-status-realtime"
import { useUploadStatusRealtime } from "@/lib/use-upload-status-realtime"
import { PARTICIPANT_UPLOAD_PHASE } from "@/lib/participant-upload-types"
import { useStaffUploadStore } from "../_lib/staff-upload-store"
import type { StaffUploadStep } from "./use-staff-upload-step"

type UploadStatusData = {
  submissions: { key: string; uploaded: boolean }[]
  participant?: {
    errors: readonly string[]
    finalized: boolean
  } | null
}

type SetStepFn = (step: StaffUploadStep) => unknown

interface UseStaffUploadStatusSyncOptions {
  domain: string
  uploadStatusData: UploadStatusData | undefined
  refetchUploadStatus: () => Promise<unknown>
  setStep: SetStepFn
}

/**
 * Syncs the upload status poll data into the store and handles completion.
 * Uses realtime for fast updates and polling only for reconciliation.
 *
 * Returns `resetCompletion` which must be called before each new upload run
 * to prevent the completion toast from being suppressed.
 */
export function useStaffUploadStatusSync({
  domain,
  uploadStatusData,
  refetchUploadStatus,
  setStep,
}: UseStaffUploadStatusSyncOptions) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const completionHandledRef = useRef(false)
  const participantFinalizedRef = useRef(false)

  const uploadFiles = useStaffUploadStore((s) => s.uploadFiles)
  const submittedReference = useStaffUploadStore((s) => s.submittedReference)
  const isUploadingFiles = useStaffUploadStore((s) => s.isUploadingFiles)
  const isPollingStatus = useStaffUploadStore((s) => s.isPollingStatus)
  const updateUploadFileState = useStaffUploadStore((s) => s.updateUploadFileState)
  const patchUpload = useStaffUploadStore((s) => s.patchUpload)
  const filesRef = useRef(uploadFiles)

  useEffect(() => {
    filesRef.current = uploadFiles
  }, [uploadFiles])

  const getFileSnapshots = useCallback(
    (): UploadRealtimeFileSnapshot[] =>
      filesRef.current.map((file) => ({
        key: file.key,
        orderIndex: file.orderIndex,
        phase: file.phase,
      })),
    [],
  )

  const completeUploadFlow = useCallback(() => {
    if (completionHandledRef.current) {
      return
    }

    completionHandledRef.current = true
    patchUpload({
      isPollingStatus: false,
      isUploadingFiles: false,
      uploadComplete: true,
      uploadErrorMessage: null,
    })
    void setStep("complete")
    toast.success("Participant created and upload completed")
    void queryClient.invalidateQueries({
      queryKey: trpc.participants.getByDomainInfinite.pathKey(),
    })
  }, [patchUpload, queryClient, setStep, trpc.participants])

  const maybeHandleCompletion = useCallback(
    (participantFinalized: boolean) => {
      if (
        !shouldCompleteUploadFlow(
          getFileSnapshots(),
          participantFinalized,
          PARTICIPANT_UPLOAD_PHASE.COMPLETED,
        )
      ) {
        return false
      }

      completeUploadFlow()
      return true
    },
    [completeUploadFlow, getFileSnapshots],
  )

  const markFileCompletedByKey = useCallback(
    (key: string) => {
      const file = filesRef.current.find((candidate) => candidate.key === key)
      if (!file || file.phase === PARTICIPANT_UPLOAD_PHASE.COMPLETED) {
        return Boolean(file)
      }

      updateUploadFileState(key, {
        phase: PARTICIPANT_UPLOAD_PHASE.COMPLETED,
        progress: 100,
        error: undefined,
      })
      return true
    },
    [updateUploadFileState],
  )

  const markFileCompletedByOrderIndex = useCallback(
    (orderIndex: number | null | undefined) => {
      const completion = getRealtimeSubmissionCompletion(
        getFileSnapshots(),
        orderIndex,
        PARTICIPANT_UPLOAD_PHASE.COMPLETED,
      )
      if (!completion) {
        return false
      }

      if (completion.shouldUpdate) {
        updateUploadFileState(completion.key, {
          phase: PARTICIPANT_UPLOAD_PHASE.COMPLETED,
          progress: 100,
          error: undefined,
        })
      }

      return true
    },
    [getFileSnapshots, updateUploadFileState],
  )

  useUploadStatusRealtime({
    domain,
    reference: submittedReference,
    enabled:
      submittedReference.length > 0 &&
      uploadFiles.length > 0 &&
      (isUploadingFiles || isPollingStatus),
    onSubmissionProcessed: ({ orderIndex }) => {
      const wasHandled = markFileCompletedByOrderIndex(orderIndex)
      if (!wasHandled) {
        void refetchUploadStatus()
        return
      }

      if (participantFinalizedRef.current) {
        maybeHandleCompletion(true)
      }
    },
    onParticipantFinalized: () => {
      participantFinalizedRef.current = true

      if (!maybeHandleCompletion(true)) {
        void refetchUploadStatus()
      }
    },
    onEventError: (_event, data) => {
      if (shouldReconcileUploadStatus(data.outcome)) {
        void refetchUploadStatus()
      }
    },
  })

  useEffect(() => {
    if (!uploadStatusData || uploadFiles.length === 0) return

    const keysToComplete = getPollingCompletionKeys(
      getFileSnapshots(),
      uploadStatusData.submissions,
      PARTICIPANT_UPLOAD_PHASE.COMPLETED,
    )

    keysToComplete.forEach((key) => {
      markFileCompletedByKey(key)
    })

    if (uploadStatusData.participant?.errors.length) {
      patchUpload({
        uploadErrorMessage: uploadStatusData.participant.errors.join(", "),
      })
    }

    if (!uploadStatusData.participant?.finalized) return

    participantFinalizedRef.current = true
    maybeHandleCompletion(true)
  }, [
    getFileSnapshots,
    markFileCompletedByKey,
    maybeHandleCompletion,
    patchUpload,
    uploadFiles,
    uploadStatusData,
  ])

  useEffect(() => {
    if (completionHandledRef.current || !participantFinalizedRef.current) {
      return
    }

    maybeHandleCompletion(true)
  }, [maybeHandleCompletion, uploadFiles])

  const resetCompletion = () => {
    completionHandledRef.current = false
    participantFinalizedRef.current = false
  }

  return { resetCompletion }
}
