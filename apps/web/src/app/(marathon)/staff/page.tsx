import { Page } from "@/lib/next-utils"
import { Effect } from "effect"
import { Suspense } from "react"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { StaffSelectDomainList } from "@/components/staff/staff-select-domain-list"
import { StaffSelectDomainTitle } from "@/components/staff/staff-select-domain-title"
import { Skeleton } from "@/components/ui/skeleton"

const _StaffPage = Effect.fn("@blikka/web/StaffPage")(function* () {
  prefetch(trpc.marathons.getUserMarathons.queryOptions())

  return (
    <HydrateClient>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden flex-col gap-4">
        <StaffSelectDomainTitle />
        <div className="w-full max-w-md relative z-10 mt-4 min-h-[500px]">
          <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-3xl" />}>
            <StaffSelectDomainList />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  )
})

export default Page(_StaffPage)
