"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tabTriggerClassName } from "../_lib/utils"

function StepCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-border/40 bg-muted/20 p-6">
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="mt-5 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="mt-auto pt-5">
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </div>
  )
}

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

      {/* Step cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StepCardSkeleton />
        <StepCardSkeleton />
        <StepCardSkeleton />
        <StepCardSkeleton />
      </div>

      {/* Stats skeleton */}
      <div className="flex items-center gap-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>

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
