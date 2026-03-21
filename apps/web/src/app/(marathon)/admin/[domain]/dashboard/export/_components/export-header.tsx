"use client"

import { Download, Circle } from "lucide-react"

interface ExportHeaderProps {
  domain: string
  marathonName?: string | null
  exportCount: number
}

export function ExportHeader({ marathonName, exportCount }: ExportHeaderProps) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
          <Download className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Data
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Exports</h1>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          Generate on-demand exports for analysis, auditing, and record keeping.
          {marathonName ? ` Data scoped to ${marathonName}.` : ""}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 tabular-nums">
          <div className="flex items-center gap-1">
            <Circle className="h-2 w-2 fill-brand-primary text-brand-primary" />
            <span className="font-medium">{exportCount}</span>
          </div>
          <span>available</span>
        </div>
      </div>
    </div>
  )
}
