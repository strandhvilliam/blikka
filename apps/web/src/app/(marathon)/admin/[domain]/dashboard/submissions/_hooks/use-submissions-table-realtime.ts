"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { QueryClient, QueryKey } from "@tanstack/react-query"
import { useRealtime } from "@/lib/realtime-client"

const TASK_NAME = {
  UPLOAD_INITIALIZER: "upload-initializer",
  UPLOAD_PROCESSOR: "upload-processor",
  UPLOAD_FINALIZER: "upload-finalizer",
} as const
const TASK_END_EVENT = {
  UPLOAD_INITIALIZER: `task.end.${TASK_NAME.UPLOAD_INITIALIZER}`,
  UPLOAD_PROCESSOR: `task.end.${TASK_NAME.UPLOAD_PROCESSOR}`,
  UPLOAD_FINALIZER: `task.end.${TASK_NAME.UPLOAD_FINALIZER}`,
} as const

const INITIALIZER_INVALIDATE_DEBOUNCE_MS = 750
const FINALIZER_SAFETY_INVALIDATE_DEBOUNCE_MS = 10_000
const MAX_TRACKED_REFERENCES = 1000

type UploadProcessorOrderIndexesByReference = Map<string, Set<number>>

interface UseSubmissionsTableRealtimeInput {
  domain: string
  queryClient: QueryClient
  participantsQueryPathKey: QueryKey
}

function upsertOrderIndexWithPruning({
  current,
  reference,
  orderIndex,
}: {
  current: UploadProcessorOrderIndexesByReference
  reference: string
  orderIndex: number
}): UploadProcessorOrderIndexesByReference {
  const next = new Map(current)
  const currentSet = next.get(reference)

  if (currentSet?.has(orderIndex)) {
    return current
  }

  const updatedSet = currentSet ? new Set(currentSet) : new Set<number>()
  updatedSet.add(orderIndex)

  // Move updated key to the end so pruning removes the oldest untouched entries.
  if (next.has(reference)) {
    next.delete(reference)
  }
  next.set(reference, updatedSet)

  while (next.size > MAX_TRACKED_REFERENCES) {
    const oldestReference = next.keys().next().value
    if (oldestReference === undefined) {
      break
    }
    next.delete(oldestReference)
  }

  return next
}

function patchParticipantStatusToCompleted(data: unknown, reference: string): unknown {
  if (!data || typeof data !== "object") {
    return data
  }

  const infiniteData = data as { pages?: unknown[] }
  if (!Array.isArray(infiniteData.pages)) {
    return data
  }

  let hasChanges = false
  const nextPages = infiniteData.pages.map((page) => {
    if (!page || typeof page !== "object") {
      return page
    }

    const pageData = page as { participants?: unknown[] }
    if (!Array.isArray(pageData.participants)) {
      return page
    }

    let pageChanged = false
    const nextParticipants = pageData.participants.map((participant) => {
      if (!participant || typeof participant !== "object") {
        return participant
      }

      const participantData = participant as {
        reference?: unknown
        status?: unknown
      }

      if (participantData.reference !== reference) {
        return participant
      }

      if (
        participantData.status === "completed" ||
        participantData.status === "verified"
      ) {
        return participant
      }

      pageChanged = true
      hasChanges = true
      return { ...participantData, status: "completed" }
    })

    if (!pageChanged) {
      return page
    }

    return { ...pageData, participants: nextParticipants }
  })

  if (!hasChanges) {
    return data
  }

  return { ...infiniteData, pages: nextPages }
}

export function useSubmissionsTableRealtime({
  domain,
  queryClient,
  participantsQueryPathKey,
}: UseSubmissionsTableRealtimeInput) {
  const [uploadProcessorOrderIndexesByReference, setUploadProcessorOrderIndexesByReference] =
    useState<UploadProcessorOrderIndexesByReference>(new Map())

  const initializerInvalidateTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalizerSafetyInvalidateTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTrackedReference = useCallback((reference: string) => {
    setUploadProcessorOrderIndexesByReference((current) => {
      if (!current.has(reference)) {
        return current
      }
      const next = new Map(current)
      next.delete(reference)
      return next
    })
  }, [])

  const scheduleInitializerInvalidate = useCallback(() => {
    if (initializerInvalidateTimeoutRef.current) {
      clearTimeout(initializerInvalidateTimeoutRef.current)
    }

    initializerInvalidateTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: participantsQueryPathKey,
      })
    }, INITIALIZER_INVALIDATE_DEBOUNCE_MS)
  }, [participantsQueryPathKey, queryClient])

  const scheduleFinalizerSafetyInvalidate = useCallback(() => {
    if (finalizerSafetyInvalidateTimeoutRef.current) {
      clearTimeout(finalizerSafetyInvalidateTimeoutRef.current)
    }

    finalizerSafetyInvalidateTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: participantsQueryPathKey,
      })
    }, FINALIZER_SAFETY_INVALIDATE_DEBOUNCE_MS)
  }, [participantsQueryPathKey, queryClient])

  const patchParticipantAsCompleted = useCallback(
    (reference: string) => {
      queryClient.setQueriesData(
        { queryKey: participantsQueryPathKey },
        (currentData) => patchParticipantStatusToCompleted(currentData, reference),
      )
    },
    [participantsQueryPathKey, queryClient],
  )

  useEffect(() => {
    return () => {
      if (initializerInvalidateTimeoutRef.current) {
        clearTimeout(initializerInvalidateTimeoutRef.current)
      }
      if (finalizerSafetyInvalidateTimeoutRef.current) {
        clearTimeout(finalizerSafetyInvalidateTimeoutRef.current)
      }
    }
  }, [])

  const realtimeEnv = process.env.NODE_ENV === "production" ? "prod" : "dev"
  const domainChannel = `${realtimeEnv}:${domain}`

  useRealtime({
    events: [
      TASK_END_EVENT.UPLOAD_INITIALIZER,
      TASK_END_EVENT.UPLOAD_PROCESSOR,
      TASK_END_EVENT.UPLOAD_FINALIZER,
    ],
    channels: [domainChannel],
    enabled: domain.length > 0,
    onData: ({ event, data }) => {
      if (event === TASK_END_EVENT.UPLOAD_INITIALIZER) {
        clearTrackedReference(data.reference)
        scheduleInitializerInvalidate()
        return
      }

      if (event === TASK_END_EVENT.UPLOAD_PROCESSOR) {
        const orderIndex = data.orderIndex
        if (orderIndex === null) {
          return
        }

        setUploadProcessorOrderIndexesByReference((current) =>
          upsertOrderIndexWithPruning({
            current,
            reference: data.reference,
            orderIndex,
          }),
        )
        return
      }

      if (event === TASK_END_EVENT.UPLOAD_FINALIZER) {
        clearTrackedReference(data.reference)
        patchParticipantAsCompleted(data.reference)
        scheduleFinalizerSafetyInvalidate()
      }
    },
  })

  return {
    uploadProcessorOrderIndexesByReference,
  }
}
