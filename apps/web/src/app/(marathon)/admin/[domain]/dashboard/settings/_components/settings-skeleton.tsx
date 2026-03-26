import { Skeleton } from "@/components/ui/skeleton"

export function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-4">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <Skeleton className="h-9 w-full shrink-0 rounded-lg sm:w-28" />
      </div>

      <div className="space-y-10">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-1.5 w-1.5 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3.5 w-full max-w-2xl" />

            <div className="space-y-4 max-w-2xl">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
