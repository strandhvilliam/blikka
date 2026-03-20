"use client"

import { QRCodeSVG } from "qrcode.react"

interface QrCodeGeneratorProps {
  value?: string
  size?: number
  level?: "L" | "M" | "Q" | "H"
}

export function QrCodeGenerator({ value, size = 256, level = "L" }: QrCodeGeneratorProps) {
  if (!value) {
    return null
  }

  return (
    <div className="rounded-2xl bg-muted p-4 shadow">
      <QRCodeSVG
        imageSettings={{
          src: "/vimmer-black.svg",
          x: undefined,
          y: undefined,
          height: 24,
          width: 38,
          excavate: true,
        }}
        level={level}
        value={value}
        size={size}
      />
    </div>
  )
}
