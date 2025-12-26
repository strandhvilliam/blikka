"use client"

import { SidebarHeader, SidebarMenu, SidebarMenuItem } from "@vimmer/ui/components/sidebar"
import { DomainSwitchDropdown } from "./sidebar-header-dropdown"
import { Skeleton } from "@vimmer/ui/components/skeleton"
import { useSession } from "@/contexts/session-context"
import { useDomain } from "@/contexts/domain-context"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"

export function AppSidebarHeader() {
  const trpc = useTRPC()
  const { user } = useSession()
  const { domain } = useDomain()
  const { data: marathons } = useSuspenseQuery(
    trpc.users.getMarathonsByUserId.queryOptions({ userId: user?.id ?? "" })
  )
  console.log({ marathons })

  if (!user) {
    return <AppSidebarHeaderSkeleton />
  }
  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <DomainSwitchDropdown marathons={marathons} activeDomain={domain} />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

export function AppSidebarHeaderSkeleton() {
  return (
    <SidebarHeader>
      <Skeleton className="h-12 w-full" />
    </SidebarHeader>
  )
}
