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
    <div className="mb-4 sm:mb-8">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
          <Tag className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Content
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Topics</h1>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground sm:max-w-lg">
          Manage and organize your marathon topics.{" "}
          <span className="hidden sm:inline">Drag topics to reorder them.</span>
          <span className="sm:hidden">Drag to reorder on a larger screen.</span>
        </p>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground/70">
            <div className="flex items-center gap-1">
              <Circle className="h-2 w-2 fill-brand-primary text-brand-primary" />
              <span className="font-medium">{topicCount}</span>
            </div>
            <span>{topicCount === 1 ? "topic" : "topics"}</span>
          </div>
          <PrimaryButton onClick={onAddTopic} className="h-9 shrink-0 px-3 text-xs sm:h-8">
            <Plus className="size-3.5" />
            <span className="md:hidden">Add</span>
            <span className="hidden md:inline">Add Topic</span>
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
