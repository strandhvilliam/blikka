import { Skeleton } from "@/components/ui/skeleton"

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-56" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md shrink-0" />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function SponsorsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:py-10">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>

      <div className="space-y-10">
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3.5 w-72 mb-5" />
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-3.5 w-72 mb-5" />
          <div className="space-y-3">
            <CardSkeleton />
          </div>
        </section>
      </div>
    </div>
  )
}
