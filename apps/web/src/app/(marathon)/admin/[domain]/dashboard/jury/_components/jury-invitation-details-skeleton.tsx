import { Skeleton } from "@/components/ui/skeleton"

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
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>

      <div className="p-5 space-y-5 max-w-3xl">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-1 w-1 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-1 w-1 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-1 w-1 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </>
  )
}
