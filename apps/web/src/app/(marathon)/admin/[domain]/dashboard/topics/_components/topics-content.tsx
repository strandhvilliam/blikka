"use client"

import { useState } from "react"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useSuspenseQuery } from "@tanstack/react-query"
import { TopicsHeader } from "./topics-header"
import { TopicsTable } from "./topics-table"
import { TopicsByCamera } from "./topics-by-camera"
import { TopicsCreateDialog } from "./topics-create-dialog"

export function TopicsContent() {
  const domain = useDomain()
  const trpc = useTRPC()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    })
  )

  if (marathon?.mode === "by-camera") {
    return <TopicsByCamera />
  }

  return (
    <div>
      <TopicsHeader onAddTopic={() => setCreateDialogOpen(true)} />
      <TopicsCreateDialog
        isOpen={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <TopicsTable onCreateTopic={() => setCreateDialogOpen(true)} />
    </div>
  )
}
