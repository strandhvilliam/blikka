import { Skeleton } from "@/components/ui/skeleton"

function ExportCardSkeleton({ hasOptions = true }: { hasOptions?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="flex items-start gap-4 p-5">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-56" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full shrink-0" />
          </div>
        </div>
      </div>
      <div className="mx-5 mb-5 pt-4 border-t border-border/50">
        {hasOptions && (
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-24 rounded-md shrink-0" />
        </div>
      </div>
    </div>
  )
}

export function ExportSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl max-w-4xl px-6 py-8 lg:py-10">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>

      <div className="space-y-10">
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-3.5 w-72 mb-5" />
          <div className="space-y-3">
            <ExportCardSkeleton hasOptions={false} />
            <ExportCardSkeleton hasOptions={false} />
            <ExportCardSkeleton />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3.5 w-64 mb-5" />
          <div className="space-y-3">
            <ExportCardSkeleton hasOptions={false} />
          </div>
        </section>
      </div>
    </div>
  )
}
