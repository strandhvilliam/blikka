"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { ExportHeader } from "./export-header"
import { ExportCard } from "./export-card"
import { EXPORT_TYPES } from "./export-types"

export function ExportContent() {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  if (!marathon) return null

  const marathonName =
    typeof marathon === "object" && marathon !== null && "name" in marathon
      ? ((marathon as { name?: string | null }).name ?? null)
      : null

  return (
    <div className="container mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
      <ExportHeader domain={domain} marathonName={marathonName} />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {EXPORT_TYPES.map((exportType) => (
          <ExportCard
            key={exportType.id}
            title={exportType.title}
            description={exportType.description}
            icon={exportType.icon}
            exportType={exportType.exportType}
            accentColor={exportType.accentColor}
            formatOptions={exportType.formatOptions}
            validationOptions={exportType.validationOptions}
            fileFormatOptions={exportType.fileFormatOptions}
          />
        ))}
      </div>
    </div>
  )
}
