"use client"

import { useEffect, useRef, useState } from "react"

interface UploadStateMessage {
  channel: string
  payload: unknown
  timestamp: number
  messageId: string
  pattern?: string
}

interface UseUploadStateOptions {
  participantReference: string | null
  domain: string | null
  enabled?: boolean
}

interface UseUploadStateReturn {
  data: UploadStateMessage | null
  events: UploadStateMessage[]
  error: Error | null
  isConnected: boolean
  isConnecting: boolean
}

export function useUploadState({
  participantReference,
  domain,
  enabled = true,
}: UseUploadStateOptions): UseUploadStateReturn {
  const [data, setData] = useState<UploadStateMessage | null>(null)
  const [events, setEvents] = useState<UploadStateMessage[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Don't connect if disabled or no participant reference
    if (!enabled || !participantReference || !domain) {
      return
    }

    // Validate participant reference format (4 alphanumeric characters)
    if (!/^[0-9a-zA-Z]{4}$/.test(participantReference)) {
      setError(new Error("Invalid participant reference format"))
      return
    }

    setIsConnecting(true)
    setError(null)
    setEvents([]) // Reset events when reconnecting

    const url = `/api/pubsub/upload-state?participantReference=${encodeURIComponent(participantReference)}&domain=${encodeURIComponent(domain)}`
    const eventSource = new EventSource(url)

    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as UploadStateMessage
        setData(parsed)
        setEvents((prev) => [...prev, parsed])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to parse message"))
      }
    }

    eventSource.onerror = (event) => {
      setIsConnecting(false)
      setIsConnected(false)

      // EventSource doesn't provide detailed error info, so we check readyState
      if (eventSource.readyState === EventSource.CLOSED) {
        setError(new Error("Connection closed"))
      } else {
        setError(new Error("Connection error"))
      }
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
      setIsConnected(false)
      setIsConnecting(false)
    }
  }, [participantReference, enabled])

  return {
    data,
    events,
    error,
    isConnected,
    isConnecting,
  }
}
