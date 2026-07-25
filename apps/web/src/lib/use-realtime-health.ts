'use client'

import { useContext } from 'react'
import { RealtimeContext } from '@upstash/realtime/client'

/**
 * Whether the realtime stream can be trusted as the primary update source; callers slow their
 * polling to a backstop while it holds.
 *
 * `connecting` counts as healthy: the ~5 min stream recycle goes disconnected→connecting in one
 * batched block, so it is never observed as a drop. A real failure parks on `disconnected`
 * through the reconnect backoff, then `error`.
 */
export function useRealtimeHealth() {
  const context = useContext(RealtimeContext)
  const status = context?.status ?? 'disconnected'

  return { isHealthy: status === 'connected' || status === 'connecting', status }
}
