import { Skeleton } from "@/components/ui/skeleton"

export function SubmissionsSkeleton() {
  return (
    <div className="mx-auto space-y-4 px-4 py-3 sm:space-y-6 sm:px-6 sm:py-4">
      {/* Header */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-32" />
              </div>
            </div>
            <Skeleton className="h-4 w-full max-w-72" />
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Skeleton className="h-9 min-h-9 flex-1 rounded-md md:h-8 md:flex-initial" />
            <Skeleton className="h-9 min-h-9 flex-1 rounded-md md:h-8 md:flex-initial" />
          </div>
        </div>
        {/* Tabs (desktop) */}
        <div className="border-b border-border hidden md:block">
          <div className="flex gap-8 overflow-x-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="mb-4 h-4 w-24 shrink-0" />
            ))}
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-md md:hidden" />
      </div>

      {/* Filters */}
      <Skeleton className="h-10 w-full rounded-md md:hidden" />
      <div className="hidden gap-3 md:flex md:flex-row md:items-center">
        <Skeleton className="h-9 w-full flex-1 rounded-md sm:w-auto" />
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
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
