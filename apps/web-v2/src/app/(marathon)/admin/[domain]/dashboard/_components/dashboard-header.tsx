"use client"

import { DashboardStatusDisplay, DashboardStatusDisplaySkeleton } from "./dashboard-status-display"
import { DomainSwitchDropdown } from "./dashboard-sidebar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LinkIcon } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Suspense } from "react"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardHeader() {
  const domain = useDomain()

  const staffSiteUrl = `https://${domain}.blikka.app/staff`
  const participantSiteUrl = `https://${domain}.blikka.app`

  return (
    <div className="z-50 w-full pr-4 bg-sidebar">
      <div className="flex h-14 items-center gap-4">
        <div className="w-64">
          <Suspense fallback={<Skeleton className="h-10 w-64" />}>
            <DashboardHeaderDomainSwitcher />
          </Suspense>
        </div>
        <div className="flex gap-2 ml-auto mr-4 border bg-sidebar-accent rounded-md items-center">
          <Button asChild variant="ghost" size="sm">
            <Link href={staffSiteUrl} className="font-normal text-sm">
              <LinkIcon className="w-4 h-4" />
              Staff Page
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-4 bg-foreground" />
          <Button asChild variant="ghost" size="sm">
            <Link href={participantSiteUrl} className="font-normal text-sm">
              <LinkIcon className="w-4 h-4" />
              Participant Page
            </Link>
          </Button>
        </div>
        <Suspense fallback={<DashboardStatusDisplaySkeleton />}>
          <DashboardStatusDisplay domain={domain} />
        </Suspense>
      </div>
    </div>
  )
}

function DashboardHeaderDomainSwitcher() {
  const trpc = useTRPC()
  const domain = useDomain()
  const { data: marathons } = useSuspenseQuery(trpc.marathons.getUserMarathons.queryOptions())

  return <DomainSwitchDropdown marathons={marathons} activeDomain={domain} />
}
