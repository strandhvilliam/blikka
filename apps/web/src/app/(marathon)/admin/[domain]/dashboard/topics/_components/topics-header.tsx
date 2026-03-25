"use client"

import { Plus, Circle, Tag } from "lucide-react"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useSuspenseQuery } from "@tanstack/react-query"

type TopicsHeaderProps = {
  onAddTopic: () => void
}

export function TopicsHeader({ onAddTopic }: TopicsHeaderProps) {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const topicCount = marathon?.topics?.length ?? 0

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
          <Tag className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Content
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Topics</h1>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          Manage and organize your marathon topics. Drag topics to reorder them.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 tabular-nums mr-1">
            <div className="flex items-center gap-1">
              <Circle className="h-2 w-2 fill-brand-primary text-brand-primary" />
              <span className="font-medium">{topicCount}</span>
            </div>
            <span>{topicCount === 1 ? "topic" : "topics"}</span>
          </div>
          <PrimaryButton onClick={onAddTopic} className="h-8 px-3 text-xs">
            <Plus className="size-3.5" />
            Add Topic
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
