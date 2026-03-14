"use client"

import { useEffect, useRef } from "react"

type NoiseOverlayProps = {
  opacity?: number
}

export function NoiseOverlay({ opacity = 0.15 }: NoiseOverlayProps) {
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
      className="pointer-events-none absolute will-change-transform"
      style={{
        opacity,
        backgroundImage: "url('/noise.png')",
        backgroundRepeat: "repeat",
        inset: "-200%",
        width: "400%",
        height: "400%",
      }}
    />
  )
}
