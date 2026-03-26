import { Skeleton } from "@/components/ui/skeleton"

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="flex min-w-0 flex-1 items-start gap-4 p-5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="max-w-lg space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-56 max-w-full" />
            </div>
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
        <div className="w-full shrink-0 border-t border-border/50 bg-muted/35 p-5 sm:w-56 sm:border-t-0 sm:border-l sm:py-5 sm:pr-5 sm:pl-6">
          <Skeleton className="aspect-[4/3] w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function SponsorsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-4">
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
