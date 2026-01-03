import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"

export function StaffDetailsSkeleton() {
  return (
    <>
      <div className="px-8 py-4">
        <div className="flex items-start justify-between bg-background shadow-sm border border-border p-4 rounded-lg">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-8">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <div className="rounded-md border p-4">
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  )
}

