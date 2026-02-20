"use client"

import { ReactLenis } from "lenis/react"
import { usePathname } from "next/navigation"
import { ReactNode } from "react"
import { LOCALES } from "@/config"

function isLandingPage(pathname: string): boolean {
  if (pathname === "/") return true
  const segments = pathname.split("/").filter(Boolean)
  return segments.length === 1 && LOCALES.includes(segments[0] as "en" | "sv")
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  if (!isLandingPage(pathname ?? "")) {
    return <>{children}</>
  }

  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        anchors: true,
        lerp: 0.08,
      }}
    >
      {children}
    </ReactLenis>
  )
}
