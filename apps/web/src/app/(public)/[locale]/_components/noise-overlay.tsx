"use client"

import { useEffect, useRef } from "react"

export function NoiseOverlay() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let rafId: number

    const tick = () => {
      const x = (Math.random() - 0.5) * 4
      const y = (Math.random() - 0.5) * 4
      el.style.transform = `translate(${x}%, ${y}%)`
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute opacity-20 will-change-transform"
      style={{
        backgroundImage: "url('/noise.png')",
        backgroundRepeat: "repeat",
        inset: "-200%",
        width: "400%",
        height: "400%",
      }}
    />
  )
}
