"use client"

import { Handshake, ImageIcon } from "lucide-react"

interface SponsorsHeaderProps {
  activeCount: number
  totalCount: number
}

export function SponsorsHeader({ activeCount, totalCount }: SponsorsHeaderProps) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
          <Handshake className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Branding
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Sponsors</h1>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          Upload sponsor images for the live landing page (one composite asset if needed), contact
          sheets, and in-app success screens when those placements are enabled.
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 tabular-nums">
          <div className="flex items-center gap-1">
            <ImageIcon className="h-3 w-3 text-brand-primary" />
            <span className="font-medium">{activeCount}</span>
          </div>
          <span>/</span>
          <span>{totalCount} uploaded</span>
        </div>
      </div>
    </div>
  )
}
