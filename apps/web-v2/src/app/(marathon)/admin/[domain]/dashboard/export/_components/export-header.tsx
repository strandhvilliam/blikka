"use client"

import { Badge } from "@/components/ui/badge"

interface ExportHeaderProps {
  domain: string
  marathonName?: string | null
}

export function ExportHeader({ domain, marathonName }: ExportHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">Exports</h1>
        <p className="text-muted-foreground text-sm">
          Generate on-demand exports for analysis, auditing, and record keeping.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {marathonName ? (
          <Badge variant="secondary" className="rounded-full">
            {marathonName}
          </Badge>
        ) : null}
        <Badge variant="outline" className="rounded-full">
          Domain: {domain}
        </Badge>
      </div>
    </div>
  )
}

