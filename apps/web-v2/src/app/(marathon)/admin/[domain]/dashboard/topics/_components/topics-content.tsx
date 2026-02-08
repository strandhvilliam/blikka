"use client"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useSuspenseQuery } from "@tanstack/react-query"
import { TopicsHeader } from "./topics-header"
import { TopicsTable } from "./topics-table"
import { TopicsByCamera } from "./topics-by-camera"

export function TopicsContent() {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    })
  )


  if (marathon?.mode === "by-camera") {
    return <TopicsByCamera />
  }

  return (
    <>
      <div className="shrink-0 mb-6">
        <TopicsHeader />
      </div>
      <div className="flex-1 min-h-0">
        <TopicsTable />
      </div>
    </>
  )
}
