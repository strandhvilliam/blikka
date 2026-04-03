import { Skeleton } from "@/components/ui/skeleton"

export function TopicsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-6 sm:py-4">
      <div className="mb-4 sm:mb-8">
        <div className="mb-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-16 w-full max-w-lg rounded-md sm:h-4" />
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-9 w-24 rounded-md sm:h-8" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid grid-cols-4 gap-4 border-b border-border/50 bg-muted/30 p-3 sm:p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-16" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-4 gap-4 border-b border-border/30 p-3 last:border-b-0 sm:p-4"
          >
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
