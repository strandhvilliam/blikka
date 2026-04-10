"use client"

import { useEffect, useState } from "react"

export function useLoopingText(texts: string[], intervalMs = 2000) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length)
    }, intervalMs)
    return () => clearInterval(interval)
  }, [texts, intervalMs])
  return texts[index]
}
