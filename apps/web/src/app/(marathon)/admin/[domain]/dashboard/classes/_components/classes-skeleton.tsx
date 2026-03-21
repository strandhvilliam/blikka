import { Skeleton } from "@/components/ui/skeleton"

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-white flex flex-col justify-between">
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2 mt-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-44" />
        </div>
      </div>
      <div className="flex items-center px-4 pb-4 gap-1.5">
        <Skeleton className="h-8 flex-1 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  )
}

export function ClassesSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-4">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-36" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>

      <div className="space-y-10">
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-3.5 w-72 mb-5" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-3.5 w-64 mb-5" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </section>
      </div>
    </div>
  )
}
