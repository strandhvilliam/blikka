"use client"

import { useCallback, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useUploadStore } from "@/lib/flow/upload-store"
import type { FinalizationState } from "@/lib/flow/types"
import { FINALIZATION_STATE, UPLOAD_PHASE } from "@/lib/flow/types"
import {
  MIN_UPLOAD_PROGRESS_DISPLAY_MS,
  PARTICIPANT_FINALIZATION_POLL_INTERVAL_MS,
  PARTICIPANT_FINALIZATION_TIMEOUT_MS,
  UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS,
  UPLOAD_FLOW_STATUS_QUERY_RETRY_COUNT,
} from "@/lib/flow/constants"

interface UseUploadFinalizationOptions {
  domain: string
  reference: string
}

export function useUploadFinalization({ domain, reference }: UseUploadFinalizationOptions) {
  const trpc = useTRPC()
  const files = useUploadStore((state) => state.files)
  const isUploading = useUploadStore((state) => state.isUploading)

  const fileListLength = files.size
  const allFilesUploaded =
    files.size > 0 &&
    Array.from(files.values()).every((file) => file.phase === UPLOAD_PHASE.UPLOADED)

  const [finalizationState, setFinalizationState] = useState<FinalizationState>(
    FINALIZATION_STATE.IDLE,
  )
  const [participantStatus, setParticipantStatus] = useState<string | null>(null)
  const [uploadUiStartedAt, setUploadUiStartedAt] = useState<number | null>(null)
  const [minimumProgressDisplayReached, setMinimumProgressDisplayReached] = useState(false)
  const [finalizationStartedAt, setFinalizationStartedAt] = useState<number | null>(null)

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

  const participantIsReady = participantStatus === "completed" || participantStatus === "verified"

  useEffect(() => {
    if (!isUploading || fileListLength === 0) return

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
  }, [allFilesUploaded, fileListLength, isUploading, participantIsReady])

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
          Math.min(1000 * 2 ** attemptIndex, UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS),
      },
    ),
  )

  useEffect(() => {
    if (!participant) {
      return
    }

    setParticipantStatus(participant.status)
  }, [participant])

  const markUploadUiStartedNow = useCallback(() => {
    setUploadUiStartedAt(Date.now())
  }, [])

  const markFinalizationUploading = useCallback(() => {
    setFinalizationState(FINALIZATION_STATE.UPLOADING)
  }, [])

  return {
    finalizationState,
    participantStatus,
    minimumProgressDisplayReached,
    resetUploadLifecycle,
    markUploadUiStartedNow,
    markFinalizationUploading,
  }
}
