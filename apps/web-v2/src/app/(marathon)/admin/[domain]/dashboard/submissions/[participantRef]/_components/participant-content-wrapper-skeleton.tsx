import { Skeleton } from "@/components/ui/skeleton"

export function ParticipantContentWrapperSkeleton() {
  return (
    <div className="space-y-0">
      <div className="border-b border-border">
        <div className="flex gap-8 -mb-px">
          <Skeleton className="h-12 w-32 rounded-none" />
          <Skeleton className="h-12 w-40 rounded-none" />
          <Skeleton className="h-12 w-36 rounded-none" />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
