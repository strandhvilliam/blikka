import * as React from "react"

/** Align with Tailwind `lg` so portrait tablets (e.g. iPad ~820px) use sheet sidebar + compact header. */
const MOBILE_BREAKPOINT = 1024
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
  mql.addEventListener("change", onStoreChange)
  window.addEventListener("resize", onStoreChange)

  return () => {
    mql.removeEventListener("change", onStoreChange)
    window.removeEventListener("resize", onStoreChange)
  }
}

function getSnapshot() {
  if (typeof window === "undefined") {
    return false
  }
  return window.innerWidth < MOBILE_BREAKPOINT
}

/** Matches SSR / first paint so `Sidebar` layout hydrates consistently, then updates after mount. */
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
