import { Skeleton } from "@/components/ui/skeleton"
import { StaffListSkeleton } from "./staff-list-skeleton"
import { StaffDetailsSkeleton } from "../[accessId]/_components/staff-details-skeleton"

export function StaffPageSkeleton() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col px-4 py-3 sm:px-6 sm:py-4">
      <div className="mb-4 shrink-0 sm:mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-32" />
              </div>
            </div>
            <Skeleton className="mt-1 h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-white">
        <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-border">
          <StaffListSkeleton />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <StaffDetailsSkeleton />
        </div>
      </div>
    </div>
  )
}
