import { Skeleton } from '@/components/ui/skeleton'

export function JuryInvitationDetailsSkeleton() {
  return (
    <>
      <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-1 w-1 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-xl sm:aspect-[16/9]" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-lg" />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-1 w-1 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>

        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </>
  )
}
