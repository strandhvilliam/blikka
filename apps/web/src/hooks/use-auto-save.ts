"use client"

import { useEffect, useRef, useCallback } from "react"

interface UseAutoSaveOptions<T> {
  value: T
  onSave: (value: T) => void
  delay?: number
  enabled?: boolean
}

export function useAutoSave<T>({
  value,
  onSave,
  delay = 500,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousValueRef = useRef<string>("")
  const onSaveRef = useRef(onSave)

  // Keep onSave ref up to date without triggering effect
  onSaveRef.current = onSave

  const cancelPendingSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const resetToValue = useCallback(
    (newValue: T) => {
      cancelPendingSave()
      previousValueRef.current = JSON.stringify(newValue)
    },
    [cancelPendingSave],
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    const currentValueStr = JSON.stringify(value)

    if (currentValueStr === previousValueRef.current) {
      return
    }

    previousValueRef.current = currentValueStr

    cancelPendingSave()

    timeoutRef.current = setTimeout(() => {
      onSaveRef.current(value)
    }, delay)

    return cancelPendingSave
  }, [value, delay, enabled, cancelPendingSave])

  useEffect(() => {
    return cancelPendingSave
  }, [cancelPendingSave])

  return {
    cancelPendingSave,
    resetToValue,
  }
}
