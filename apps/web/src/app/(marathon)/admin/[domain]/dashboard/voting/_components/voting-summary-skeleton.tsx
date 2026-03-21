"use client"

import { Skeleton } from "@/components/ui/skeleton"

function StepCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-border/40 bg-muted/10 p-6">
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
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
      </div>

      {/* Step cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StepCardSkeleton />
        <StepCardSkeleton />
        <StepCardSkeleton />
        <StepCardSkeleton />
      </div>

      {/* Stats */}
      <div className="mt-5 flex items-center gap-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Tabs */}
      <div className="mt-8 border-b border-border">
        <div className="flex gap-8">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-4 w-16 mb-4" />
        </div>
      </div>
    </>
  )
}
