import { Skeleton } from "@/components/ui/skeleton"
import { JuryListSkeleton } from "./jury-list-skeleton"
import { JuryInvitationDetailsSkeleton } from "./jury-invitation-details-skeleton"

export function JuryPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] h-full flex flex-col px-4 py-3 sm:px-6 sm:py-4">
      <div className="shrink-0 mb-4 sm:mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-40" />
              </div>
            </div>
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex rounded-xl border border-border bg-white overflow-hidden">
        <div className="w-80 shrink-0 flex flex-col border-r border-border overflow-hidden">
          <JuryListSkeleton />
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <JuryInvitationDetailsSkeleton />
        </div>
      </div>
    </div>
  )
}
