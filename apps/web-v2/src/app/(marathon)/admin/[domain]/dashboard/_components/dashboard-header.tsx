"use client"

import { DashboardStatusDisplay, DashboardStatusDisplaySkeleton } from "./dashboard-status-display"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LinkIcon, Menu } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Suspense } from "react"
import { useDomain } from "@/lib/domain-provider"

export function DashboardHeader() {
  const domain = useDomain()

  const staffSiteUrl = `https://${domain}.blikka.app/staff`
  const participantSiteUrl = `https://${domain}.blikka.app`

  return (
    <div className="z-50 w-full px-4 bg-sidebar">
      <div className="flex h-14 items-center">
        <SidebarTrigger>
          <Button variant="ghost" size="icon" className="mr-4">
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </SidebarTrigger>
        {/* <div className="ml-4">
          <ParticipantQuickSearch />
        </div> */}
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
