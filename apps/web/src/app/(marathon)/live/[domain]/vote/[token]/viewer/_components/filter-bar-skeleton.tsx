"use client";
import { Skeleton } from "@/components/ui/skeleton";
export function FilterBarSkeleton() {
  return (
    <div className="px-4 py-3">
      {/* Action buttons skeleton */}
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      {/* Progress bar skeleton */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
      {/* Filter options skeleton */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-12 rounded-full shrink-0" />
        ))}
      </div>
    </div>
  )
} 