import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"

export function StaffDetailsSkeleton() {
  return (
    <>
      <div className="border-b border-border bg-white">
        <div className="px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-6 w-36" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 px-8 py-6">
          {/* Access card skeleton */}
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-full rounded-lg" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-28 rounded-md" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            </div>
          </div>

          {/* Section header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56 mt-1" />
          </div>

          {/* Table skeleton */}
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="rounded-md border border-border overflow-hidden">
            <div className="bg-muted/30 px-4 py-3">
              <div className="flex gap-8">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-20" />
                ))}
              </div>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-t border-border px-4 py-3.5">
                <div className="flex gap-8">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </>
  )
}
