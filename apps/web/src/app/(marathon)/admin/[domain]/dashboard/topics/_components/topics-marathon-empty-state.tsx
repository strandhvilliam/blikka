"use client"

import { ListOrdered, Plus } from "lucide-react"
import { PrimaryButton } from "@/components/ui/primary-button"

type TopicsMarathonEmptyStateProps = {
  onCreateClick: () => void
}

export function TopicsMarathonEmptyState({
  onCreateClick,
}: TopicsMarathonEmptyStateProps) {
  return (
    <div className="flex min-w-0 w-full flex-col items-stretch justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <div className="flex flex-col items-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
          <ListOrdered className="size-6 text-brand-primary" />
        </div>
        <h2 className="font-gothic text-xl tracking-tight text-foreground">
          No topics yet
        </h2>
      </div>
      <p className="mt-2 min-w-0 max-w-lg text-balance text-sm leading-relaxed text-muted-foreground mx-auto">
        Add your first topic to start building the marathon sequence. You can drag
        topics to change their order anytime.
      </p>
      <PrimaryButton onClick={onCreateClick} className="mt-6 mx-auto">
        <Plus className="size-4" />
        Create your first topic
      </PrimaryButton>
    </div>
  )
}
