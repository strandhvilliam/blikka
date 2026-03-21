"use client"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Layers, Circle } from "lucide-react"

export function ClassesHeader() {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain })
  )

  const classCount = marathon?.competitionClasses?.length ?? 0
  const groupCount = marathon?.deviceGroups?.length ?? 0

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
          <Layers className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Organization
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">
            Classes & Devices
          </h1>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          Manage competition classes and device groups for your marathon. These will be selectable by
          participants during the upload process.
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground/70 tabular-nums">
          <div className="flex items-center gap-1">
            <Circle className="h-2 w-2 fill-brand-primary text-brand-primary" />
            <span className="font-medium">{classCount}</span>
            <span>{classCount === 1 ? "class" : "classes"}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1">
            <span className="font-medium">{groupCount}</span>
            <span>{groupCount === 1 ? "group" : "groups"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
