"use client"

import { useEffect, useRef, useState } from "react"

interface UploadStateMessage {
  channel: string
  payload: unknown
  timestamp: number
  messageId: string
  pattern?: string
}

interface ParticipantUploadState {
  participantReference: string
  data: UploadStateMessage | null
  events: UploadStateMessage[]
  error: Error | null
  isConnected: boolean
  isConnecting: boolean
}

interface UseMultipleUploadStatesOptions {
  participantReferences: string[]
  domain: string
  enabled?: boolean
}

interface UseMultipleUploadStatesReturn {
  states: Record<string, ParticipantUploadState>
  allEvents: Array<UploadStateMessage & { participantReference: string }>
  totalConnected: number
  totalConnecting: number
  hasErrors: boolean
}

export function useMultipleUploadStates({
  participantReferences,
  domain,
  enabled = true,
}: UseMultipleUploadStatesOptions): UseMultipleUploadStatesReturn {
  const [states, setStates] = useState<Record<string, ParticipantUploadState>>({})
  const eventSourceRefs = useRef<Record<string, EventSource>>({})

  useEffect(() => {
    if (!enabled || !domain || participantReferences.length === 0) {
      // Cleanup if disabled
      Object.values(eventSourceRefs.current).forEach((eventSource) => {
        eventSource.close()
      })
      eventSourceRefs.current = {}
      setStates({})
      return
    }

    // Close all existing connections first
    Object.values(eventSourceRefs.current).forEach((eventSource) => {
      eventSource.close()
    })
    eventSourceRefs.current = {}

    // Initialize states for all participants
    const initialStates: Record<string, ParticipantUploadState> = {}
    participantReferences.forEach((ref) => {
      if (!/^[0-9]{4}$/.test(ref)) {
        initialStates[ref] = {
          participantReference: ref,
          data: null,
          events: [],
          error: new Error("Invalid participant reference format"),
          isConnected: false,
          isConnecting: false,
        }
        return
      }

      initialStates[ref] = {
        participantReference: ref,
        data: null,
        events: [],
        error: null,
        isConnected: false,
        isConnecting: true,
      }
    })
    setStates(initialStates)

    // Create EventSource for each participant
    participantReferences.forEach((participantReference) => {
      if (!/^[0-9]{4}$/.test(participantReference)) {
        return
      }

      const url = `/api/pubsub/upload-state?participantReference=${encodeURIComponent(participantReference)}&domain=${encodeURIComponent(domain)}`
      const eventSource = new EventSource(url)

      eventSourceRefs.current[participantReference] = eventSource

      eventSource.onopen = () => {
        setStates((prev) => ({
          ...prev,
          [participantReference]: {
            ...prev[participantReference]!,
            isConnected: true,
            isConnecting: false,
            error: null,
          },
        }))
      }

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as UploadStateMessage
          setStates((prev) => ({
            ...prev,
            [participantReference]: {
              ...prev[participantReference]!,
              data: parsed,
              events: [...prev[participantReference]!.events, parsed],
              error: null,
            },
          }))
        } catch (err) {
          setStates((prev) => ({
            ...prev,
            [participantReference]: {
              ...prev[participantReference]!,
              error: err instanceof Error ? err : new Error("Failed to parse message"),
            },
          }))
        }
      }

      eventSource.onerror = (event) => {
        const source = eventSourceRefs.current[participantReference]
        setStates((prev) => ({
          ...prev,
          [participantReference]: {
            ...prev[participantReference]!,
            isConnecting: false,
            isConnected: false,
            error:
              source?.readyState === EventSource.CLOSED
                ? new Error("Connection closed")
                : new Error("Connection error"),
          },
        }))
      }
    })

    // Cleanup function
    return () => {
      Object.values(eventSourceRefs.current).forEach((eventSource) => {
        eventSource.close()
      })
      eventSourceRefs.current = {}
      setStates({})
    }
  }, [participantReferences.join(","), domain, enabled])

  // Compute derived values
  const allEvents = Object.entries(states).flatMap(([ref, state]) =>
    state.events.map((event) => ({ ...event, participantReference: ref }))
  )

  const totalConnected = Object.values(states).filter((s) => s.isConnected).length
  const totalConnecting = Object.values(states).filter((s) => s.isConnecting).length
  const hasErrors = Object.values(states).some((s) => s.error !== null)

  // Sort events by timestamp
  allEvents.sort((a, b) => a.timestamp - b.timestamp)

  return {
    states,
    allEvents,
    totalConnected,
    totalConnecting,
    hasErrors,
  }
}

