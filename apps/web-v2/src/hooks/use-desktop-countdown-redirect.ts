import { useEffect, useRef, useState } from "react"

export interface UseDesktopCountdownRedirectOptions {
  initialSeconds?: number
  isEnabled?: boolean
  onRedirect: () => void
}

export interface UseDesktopCountdownRedirectResult {
  remainingSeconds: number
  addSeconds: (seconds: number) => void
  reset: (seconds?: number) => void
}

export function useDesktopCountdownRedirect(
  options: UseDesktopCountdownRedirectOptions
): UseDesktopCountdownRedirectResult {
  const { initialSeconds = 15, isEnabled = true, onRedirect } = options
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialSeconds)

  const redirectRef = useRef(onRedirect)
  useEffect(() => {
    redirectRef.current = onRedirect
  }, [onRedirect])

  useEffect(() => {
    if (!isEnabled) return
    if (typeof window === "undefined") return
    const isDesktop = window.matchMedia("(min-width: 768px)").matches
    if (!isDesktop) return
    if (remainingSeconds <= 0) {
      redirectRef.current()
      return
    }

    const id = window.setTimeout(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => clearTimeout(id)
  }, [remainingSeconds, isEnabled])

  function addSeconds(seconds: number) {
    setRemainingSeconds((current) => current + seconds)
  }

  function reset(seconds: number = initialSeconds) {
    setRemainingSeconds(seconds)
  }

  return { remainingSeconds, addSeconds, reset }
}
