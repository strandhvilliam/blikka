"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tabTriggerClassName } from "../_lib/utils"

export function VotingSummarySkeleton() {
  return (
    <>
      {/* Header skeleton */}
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </section>

      {/* Tabs skeleton */}
      <Tabs defaultValue="leaderboard" className="space-y-0">
        <div className="border-b border-border">
          <TabsList className="bg-transparent rounded-none p-0 h-auto flex gap-8 -mb-px">
            <TabsTrigger value="leaderboard" className={tabTriggerClassName}>
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="voters" className={tabTriggerClassName}>
              Voters
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
    </>
  )
}
