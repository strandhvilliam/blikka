import { Skeleton } from "@/components/ui/skeleton"

export function ParticipantContentWrapperSkeleton() {
  return (
    <div className="space-y-0">
      <div className="border-b border-border">
        <div className="flex gap-8">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-4 w-28 mb-4" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white overflow-hidden">
            <Skeleton className="aspect-4/3 w-full" />
            <div className="px-4 py-3">
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
