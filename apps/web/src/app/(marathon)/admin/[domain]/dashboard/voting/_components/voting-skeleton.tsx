"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function VotingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:py-10">
      <div className="space-y-8 pb-8">
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
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/40 bg-muted/10 p-6">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="mt-5 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <Skeleton className="mt-4 h-9 w-full rounded-md" />
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex gap-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Tab bar */}
        <div className="border-b border-border pt-4">
          <div className="flex gap-8">
            <Skeleton className="h-4 w-24 mb-4" />
            <Skeleton className="h-4 w-16 mb-4" />
          </div>
        </div>

        {/* Tab content placeholder */}
        <div className="space-y-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
