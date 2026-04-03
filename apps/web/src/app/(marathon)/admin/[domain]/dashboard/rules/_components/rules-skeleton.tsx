import { Skeleton } from "@/components/ui/skeleton"

export function RulesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-4">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-3 w-16 mb-1.5" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Skeleton className="h-[18px] w-40 mb-2" />
                    <Skeleton className="h-4 w-full max-w-xs" />
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full shrink-0" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
