import { Skeleton } from "@/components/ui/skeleton"

export function TopicsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-80" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-border/50 bg-muted/30">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-16" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-4 p-4 border-b border-border/30 last:border-b-0">
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
