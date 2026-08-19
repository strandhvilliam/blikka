'use client'

import { useCallback, useEffect, useRef } from 'react'

export type JuryNavDirection = -1 | 1

/** Slow enough that a held arrow paces through the list, fast enough that a single press feels instant. */
const DEFAULT_NAV_INTERVAL_MS = 200

/**
 * Paging is throttled, not debounced: the first press lands immediately, so a deliberate click never
 * waits. Presses that arrive inside the cooldown are collapsed into one trailing step (last direction
 * wins), so hammering or holding an arrow walks the list at a steady pace instead of tearing through
 * it — and the final press is still honoured rather than swallowed.
 */
export function useJuryNavThrottle({
  onStep,
  intervalMs = DEFAULT_NAV_INTERVAL_MS,
}: {
  onStep: (direction: JuryNavDirection) => void
  intervalMs?: number
}) {
  const onStepRef = useRef(onStep)
  const lastStepAtRef = useRef(0)
  const pendingRef = useRef<JuryNavDirection | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onStepRef.current = onStep
  }, [onStep])

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    },
    [],
  )

  const step = useCallback(
    (direction: JuryNavDirection) => {
      const elapsed = Date.now() - lastStepAtRef.current

      if (elapsed >= intervalMs) {
        lastStepAtRef.current = Date.now()
        onStepRef.current(direction)
        return
      }

      pendingRef.current = direction
      if (timerRef.current !== null) return

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        const pending = pendingRef.current
        pendingRef.current = null
        if (pending === null) return
        lastStepAtRef.current = Date.now()
        onStepRef.current(pending)
      }, intervalMs - elapsed)
    },
    [intervalMs],
  )

  const goToPrev = useCallback(() => step(-1), [step])
  const goToNext = useCallback(() => step(1), [step])

  return { goToPrev, goToNext }
}
