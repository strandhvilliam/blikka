"use client"

import { useDomain } from "@/lib/domain-provider"
import { useEffect } from "react"

export function useParticipantEvents() {
  const domain = useDomain()

  useEffect(() => {
    if (!domain) {
      return
    }

    const url = `/api/pubsub/participant-events?domain=${encodeURIComponent(domain)}`
    const eventSource = new EventSource(url)

    eventSource.onopen = () => {
      console.log("Connected to participant events stream")
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log("Participant event received:", data)
      } catch (error) {
        console.error("Failed to parse participant event data:", error)
      }
    }

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error)
    }

    return () => {
      eventSource.close()
      console.log("Disconnected from participant events stream")
    }
  }, [domain])
}
