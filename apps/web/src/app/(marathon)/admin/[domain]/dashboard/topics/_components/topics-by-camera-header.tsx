"use client"

import { Plus, Circle, Tag } from "lucide-react"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useSuspenseQuery } from "@tanstack/react-query"

type TopicsByCameraHeaderProps = {
  onCreateClick: () => void
  isLoading: boolean
}

export function TopicsByCameraHeader({ onCreateClick, isLoading }: TopicsByCameraHeaderProps) {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const topicCount = marathon?.topics?.length ?? 0

  return (
    <div className="mb-2">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
          <Tag className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            By Camera
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Topics</h1>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground sm:max-w-lg">
          Each event runs on a single active topic. Activate a topic first, then open submissions
          when you&apos;re ready to accept uploads.
        </p>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:shrink-0 sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground/70">
            <div className="flex items-center gap-1">
              <Circle className="h-2 w-2 fill-brand-primary text-brand-primary" />
              <span className="font-medium">{topicCount}</span>
            </div>
            <span>{topicCount === 1 ? "topic" : "topics"}</span>
          </div>
          <PrimaryButton
            onClick={onCreateClick}
            disabled={isLoading}
            className="h-9 shrink-0 px-3 text-xs sm:h-8"
          >
            <Plus className="size-3.5" />
            <span className="md:hidden">New</span>
            <span className="hidden md:inline">New Topic</span>
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
