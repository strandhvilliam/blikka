"use client"

import { useEffect, useState } from "react"

export default function ParticipatePage() {
  const [events, setEvents] = useState<unknown[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const env = process.env.NODE_ENV === "development" ? "dev" : "prod"
    const channel = `${env}:upload-flow:test:123`
    const eventSource = new EventSource(
      `/api/pubsub/upload-state?channel=${encodeURIComponent(channel)}`
    )

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setEvents((prev) => [...prev, data])
      } catch (err) {
        console.error("Failed to parse event data:", err)
      }
    }

    eventSource.onerror = (err) => {
      setError("Connection error occurred")
      setIsConnected(false)
      console.error("EventSource error:", err)
    }

    return () => {
      eventSource.close()
      setIsConnected(false)
    }
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Participate</h1>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`} />
          <span className="text-sm">{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <div className="mt-4">
        <h2 className="text-lg font-semibold mb-2">Events ({events.length})</h2>
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm">No events received yet...</p>
        ) : (
          <ul className="space-y-2">
            {events.map((event, index) => (
              <li key={index} className="p-3 bg-gray-100 rounded border border-gray-200">
                <pre className="text-sm overflow-auto">{JSON.stringify(event, null, 2)}</pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
