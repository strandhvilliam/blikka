import { Skeleton } from '@/components/ui/skeleton'

export function DashboardHomeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-16 pt-2 sm:px-6 md:px-10">
      <div className="mb-8 max-w-2xl space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <Skeleton className="mb-6 h-8 w-56 rounded-full" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
