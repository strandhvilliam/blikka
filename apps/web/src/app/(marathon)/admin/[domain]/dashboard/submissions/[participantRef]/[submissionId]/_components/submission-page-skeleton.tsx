import { Skeleton } from "@/components/ui/skeleton"

export function SubmissionPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-40" />
            <div className="flex items-center gap-2 mt-1">
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        </div>
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-6">
          <Skeleton className="aspect-4/3 w-full rounded-xl" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-white p-5 space-y-4">
            <Skeleton className="h-5 w-28" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="border-b border-border bg-muted/20 px-4 py-3">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-3 px-3 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-2.5">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
