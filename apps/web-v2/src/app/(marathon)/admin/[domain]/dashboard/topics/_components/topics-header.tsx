"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { PrimaryButton } from "@/components/ui/primary-button"
import { TopicsCreateDialog } from "./topics-create-dialog"

export function TopicsHeader() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">Topics</h1>
          <p className="text-muted-foreground text-sm">
            Manage and organize your marathon topics. Drag topics to reorder them.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
            Add Topic
          </PrimaryButton>
        </div>
      </div>

      <TopicsCreateDialog isOpen={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  )
}
