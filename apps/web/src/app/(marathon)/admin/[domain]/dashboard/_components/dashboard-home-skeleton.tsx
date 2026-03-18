import { Skeleton } from "@/components/ui/skeleton"

export function DashboardHomeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 pt-2 md:px-10">
      <div className="mb-12 max-w-2xl space-y-3 md:mb-16">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <div className="mb-14 space-y-6 md:mb-16">
        <Skeleton className="h-3 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <Skeleton className="h-3 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
