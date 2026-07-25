'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import { RealtimeContext } from '@upstash/realtime/client'

/**
 * How long a non-connected stream is still treated as healthy.
 *
 * The server recycles each SSE stream on its own timer (the library's `maxDurationSecs`,
 * ~5 min) and the client immediately reconnects, so short gaps are routine rather than a
 * sign of trouble. Only a gap that outlasts this window means we are actually blind.
 */
const REALTIME_HEALTH_GRACE_MS = 20_000

/**
 * Whether the shared realtime stream can currently be trusted as the primary source of
 * updates. Callers use it to slow their polling down to a safety net while it holds, and
 * to speed back up when it doesn't.
 *
 * Starts unhealthy: until the stream has connected once, polling is all we have.
 */
export function useRealtimeHealth() {
  const context = useContext(RealtimeContext)
  const status = context?.status ?? 'disconnected'
  const [isHealthy, setIsHealthy] = useState(false)
  const hasConnectedRef = useRef(false)

  useEffect(() => {
    if (status === 'connected') {
      hasConnectedRef.current = true
      setIsHealthy(true)
      return
    }

    // Terminal: the provider gave up reconnecting. Polling is the only signal left.
    if (status === 'error' || !hasConnectedRef.current) {
      setIsHealthy(false)
      return
    }

    const timeout = window.setTimeout(() => setIsHealthy(false), REALTIME_HEALTH_GRACE_MS)
    return () => window.clearTimeout(timeout)
  }, [status])

  return { isHealthy, status }
}
