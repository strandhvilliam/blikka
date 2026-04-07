import { JuryListSkeleton } from "./jury-list-skeleton"
import { JuryInvitationDetailsSkeleton } from "./jury-invitation-details-skeleton"

export function JuryPageSkeleton() {
  return (
    <div className="flex h-full gap-5 mx-auto w-full max-w-[1600px] px-6 py-4">
      <div className="w-80 shrink-0 flex flex-col rounded-xl border border-border bg-white overflow-hidden">
        <div className="border-b border-border px-4 py-4">
          <div className="h-8 w-40 rounded-md bg-muted/50 animate-pulse" />
        </div>
        <JuryListSkeleton />
      </div>
      <div className="flex-1 flex flex-col h-full rounded-xl border border-border bg-white overflow-hidden">
        <JuryInvitationDetailsSkeleton />
      </div>
    </div>
  )
}
