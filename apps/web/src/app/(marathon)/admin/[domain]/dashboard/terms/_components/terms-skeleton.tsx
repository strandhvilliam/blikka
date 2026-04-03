import { Skeleton } from "@/components/ui/skeleton"

export function TermsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-4">
      <div className="mb-10">
        <div className="mb-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-6 w-48" />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mt-1">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="space-y-6">
        <div className="space-y-2 max-w-2xl">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-[320px] w-full rounded-md" />
        </div>
        <div className="space-y-2 max-w-2xl">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-[42px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
