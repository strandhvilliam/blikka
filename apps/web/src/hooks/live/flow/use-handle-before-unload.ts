import { useEffect } from 'react'

export function useHandleBeforeUnload(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const isOnIOS = navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPhone/i)

    if (isOnIOS) {
      window.addEventListener('pagehide', handleBeforeUnload)
    } else {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    return () => {
      if (isOnIOS) {
        window.removeEventListener('pagehide', handleBeforeUnload)
      } else {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [enabled])
}
