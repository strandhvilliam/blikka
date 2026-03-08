"use client"

import { useCallback, useState } from "react"
import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query"
import { useDebouncedInvalidate } from "@/hooks/use-debounced-invalidate"
import {
  getDomainRealtimeChannel,
  getRealtimeChannelEnvironmentFromNodeEnv,
  getRealtimeResultEventName,
} from "@blikka/realtime/contract"
import { useRealtime } from "@/lib/realtime-client"
import type { TableData } from "./use-submissions-table"

const RESULT_EVENT = {
  uploadFlowInitializer: getRealtimeResultEventName("upload-flow-initialized"),
  submissionProcessed: getRealtimeResultEventName("submission-processed"),
  participantFinalized: getRealtimeResultEventName("participant-finalized"),
} as const

const INITIALIZER_INVALIDATE_DEBOUNCE_MS = 750
const TASK_ERROR_INVALIDATE_DEBOUNCE_MS = 750
const FINALIZER_SAFETY_INVALIDATE_DEBOUNCE_MS = 10_000
const MAX_TRACKED_REFERENCES = 1000

const realtimeEnv = getRealtimeChannelEnvironmentFromNodeEnv(process.env.NODE_ENV)

type UploadProcessorOrderIndexesByReference = Map<string, Set<number>>

interface ParticipantsPage {
  participants: TableData[]
  nextCursor?: number | null
}

type InfiniteParticipantsData = InfiniteData<ParticipantsPage>

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

function patchParticipantStatusToCompleted(
  data: InfiniteParticipantsData | undefined,
  reference: string,
): InfiniteParticipantsData | undefined {
  if (!data) return data

  let hasChanges = false
  const nextPages = data.pages.map((page) => {
    let pageChanged = false
    const nextParticipants = page.participants.map((participant) => {
      if (participant.reference !== reference) return participant
      if (participant.status === "completed" || participant.status === "verified") {
        return participant
      }

      pageChanged = true
      hasChanges = true
      return { ...participant, status: "completed" as const }
    })

    return pageChanged ? { ...page, participants: nextParticipants } : page
  })

  return hasChanges ? { ...data, pages: nextPages } : data
}

export function useSubmissionsTableRealtime({
  domain,
  queryClient,
  participantsQueryPathKey,
}: UseSubmissionsTableRealtimeInput) {
  const [uploadProcessorOrderIndexesByReference, setUploadProcessorOrderIndexesByReference] =
    useState<UploadProcessorOrderIndexesByReference>(new Map())

  const scheduleInitializerInvalidate = useDebouncedInvalidate(
    queryClient, participantsQueryPathKey, INITIALIZER_INVALIDATE_DEBOUNCE_MS,
  )
  const scheduleTaskErrorInvalidate = useDebouncedInvalidate(
    queryClient, participantsQueryPathKey, TASK_ERROR_INVALIDATE_DEBOUNCE_MS,
  )
  const scheduleFinalizerSafetyInvalidate = useDebouncedInvalidate(
    queryClient, participantsQueryPathKey, FINALIZER_SAFETY_INVALIDATE_DEBOUNCE_MS,
  )

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

  const patchParticipantAsCompleted = useCallback(
    (reference: string) => {
      queryClient.setQueriesData<InfiniteParticipantsData>(
        { queryKey: participantsQueryPathKey },
        (currentData) => patchParticipantStatusToCompleted(currentData, reference),
      )
    },
    [participantsQueryPathKey, queryClient],
  )

  const domainChannel = getDomainRealtimeChannel(realtimeEnv, domain)

  useRealtime({
    events: [
      RESULT_EVENT.uploadFlowInitializer,
      RESULT_EVENT.submissionProcessed,
      RESULT_EVENT.participantFinalized,
    ],
    channels: [domainChannel],
    enabled: domain.length > 0,
    onData: ({ event, data }) => {
      switch (event) {
        case RESULT_EVENT.uploadFlowInitializer:
          if (data.reference) {
            clearTrackedReference(data.reference)
          }
          scheduleInitializerInvalidate()
          break

        case RESULT_EVENT.submissionProcessed:
          if (data.outcome === "error") {
            scheduleTaskErrorInvalidate()
            break
          }
          const { reference, orderIndex } = data
          if (reference && orderIndex !== null) {
            setUploadProcessorOrderIndexesByReference((current) =>
              upsertOrderIndexWithPruning({ current, reference, orderIndex }),
            )
          }
          break

        case RESULT_EVENT.participantFinalized:
          if (data.reference) {
            clearTrackedReference(data.reference)
          }
          if (data.outcome === "error") {
            scheduleTaskErrorInvalidate()
            break
          }
          if (data.reference) {
            patchParticipantAsCompleted(data.reference)
            scheduleFinalizerSafetyInvalidate()
          }
          break
      }
    },
  })

  return {
    uploadProcessorOrderIndexesByReference,
  }
}
