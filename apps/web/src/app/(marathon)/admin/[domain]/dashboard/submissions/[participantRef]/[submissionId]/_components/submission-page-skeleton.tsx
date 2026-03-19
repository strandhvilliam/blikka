import { Skeleton } from "@/components/ui/skeleton"

export function SubmissionPageSkeleton() {
  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-56 sm:h-9" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
        <Skeleton className="h-10 w-32 shrink-0" />
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-24" />
            </div>
            <Skeleton className="aspect-[4/3] w-full rounded-xl shadow-md" />
          </div>

          <div className="rounded-lg border p-4 shadow-sm">
            <Skeleton className="mb-3 h-3 w-16" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>

          <div className="rounded-lg border p-5 shadow-sm">
            <Skeleton className="mb-2 h-6 w-48" />
            <Skeleton className="mb-4 h-4 w-full max-w-sm" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2 pt-0.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="overflow-hidden rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-4 space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-6 h-24 w-full rounded-lg" />
            <Skeleton className="mt-2 h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
