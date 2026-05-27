import { Skeleton } from '@/components/ui/skeleton'

export function ParticipantHeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
        <div className="border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white">
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
