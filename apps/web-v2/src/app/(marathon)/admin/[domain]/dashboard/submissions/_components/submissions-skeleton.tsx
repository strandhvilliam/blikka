import { Skeleton } from "@/components/ui/skeleton"

export function SubmissionsSkeleton() {
  return (
    <div className="container mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="border-b border-border">
          <div className="flex gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-32" />
            ))}
          </div>
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Skeleton className="h-10 flex-1 w-full sm:w-auto" />
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <Skeleton className="h-10 w-[160px]" />
            <Skeleton className="h-10 w-[220px]" />
            <Skeleton className="h-10 w-[200px]" />
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="border-b bg-muted/30">
            <div className="grid grid-cols-8 gap-4 px-4 py-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4" />
              ))}
            </div>
          </div>
          <div className="divide-y">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-8 gap-4 px-4 py-3">
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="h-5" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

