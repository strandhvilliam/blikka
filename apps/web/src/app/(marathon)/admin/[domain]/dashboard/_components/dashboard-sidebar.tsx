"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarMenuItem,
  SidebarMenu,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DashboardSidebarHeader } from "./dashboard-sidebar-header"
import SidebarLinks from "./sidebar-links"
import { SidebarNavUser } from "./sidebar-nav-user"

export { DashboardSidebarHeader } from "./dashboard-sidebar-header"
export { DomainSwitchDropdown } from "./domain-switch-dropdown"
export { NAV_LINKS } from "./sidebar-links"
export { default as SidebarLinks } from "./sidebar-links"
export { SidebarNavUser } from "./sidebar-nav-user"

export function DashboardSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-none bg-sidebar z-20">
      <DashboardSidebarHeader />
      <SidebarContent>
        <div className="group-data-[collapsible=icon]:flex hidden px-2 justify-center items-center">
          <SidebarTrigger className="p-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground " />
        </div>
        <SidebarLinks />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarNavUser />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
