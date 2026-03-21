"use client"

import { QRCodeSVG } from "qrcode.react"

interface QrCodeGeneratorProps {
  value?: string
  size?: number
  level?: "L" | "M" | "Q" | "H"
}

const LOGO_ASPECT = 299 / 358

export function QrCodeGenerator({ value, size = 256, level = "H" }: QrCodeGeneratorProps) {
  if (!value) {
    return null
  }

  const logoWidth = Math.round(size * 0.2)
  const logoHeight = Math.round(logoWidth * LOGO_ASPECT)

  return (
    <div className="rounded-2xl bg-muted p-4 shadow">
      <QRCodeSVG
        imageSettings={{
          src: "/blikka-logo-dark-qr.svg",
          x: undefined,
          y: undefined,
          height: logoHeight,
          width: logoWidth,
          excavate: true,
        }}
        level={level}
        value={value}
        size={size}
      />
    </div>
  )
}
