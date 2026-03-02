"use client"

import { useEffect, useState } from "react"
import { Scanner } from "@yudiel/react-qr-scanner"

interface QrScannerProps {
  onScan: (value: string | null) => void
  onError: (error: Error) => void
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Scanner
      onScan={(result) => {
        const rawValue = result[0]?.rawValue ?? null

        if (rawValue && navigator.vibrate) {
          navigator.vibrate(100)
        }

        onScan(rawValue)
      }}
      sound={true}
      components={{
        finder: false,
      }}
      classNames={{
        container: "flex h-full w-full items-center justify-center",
        video: "h-full w-full object-cover",
      }}
      onError={(error) => {
        if (error instanceof Error) {
          onError(error)
        }
      }}
    />
  )
}
