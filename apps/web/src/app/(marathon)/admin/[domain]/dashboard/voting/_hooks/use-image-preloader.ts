import { useState, useEffect } from "react"
export function useImagePreloader(urls: (string | undefined)[]) {
  const [loaded, setLoaded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const validUrls = urls.filter((u): u is string => !!u)
    if (validUrls.length === 0) return

    let cancelled = false
    const tracker = new Set<string>()

    for (const url of validUrls) {
      const img = new window.Image()
      img.onload = () => {
        if (cancelled) return
        tracker.add(url)
        setLoaded(new Set(tracker))
      }
      img.onerror = () => {
        if (cancelled) return
        tracker.add(url)
        setLoaded(new Set(tracker))
      }
      img.src = url
    }

    return () => {
      cancelled = true
    }
  }, [urls])

  const validCount = urls.filter(Boolean).length
  const allLoaded = validCount === 0 || loaded.size >= validCount

  return { loaded, allLoaded }
}
