import { Skeleton } from "@/components/ui/skeleton"

export function SubmissionsSkeleton() {
  return (
    <div className="mx-auto px-6 py-4 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-32" />
              </div>
            </div>
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-24 mb-4" />
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Skeleton className="h-9 flex-1 w-full sm:w-auto rounded-md" />
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Skeleton className="h-9 w-[140px] rounded-md" />
          <Skeleton className="h-9 w-[180px] rounded-md" />
          <Skeleton className="h-9 w-[160px] rounded-md" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="border-b bg-muted/30">
          <div className="grid grid-cols-8 gap-4 px-4 py-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-3" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="grid grid-cols-8 gap-4 px-4 py-3">
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} className="h-4" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
