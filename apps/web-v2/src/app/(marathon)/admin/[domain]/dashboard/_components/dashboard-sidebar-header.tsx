"use client"

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import Image from "next/image"

export function DashboardSidebarHeader() {
  return (
    <SidebarHeader className="px-4 group-data-[collapsible=icon]:p-2">
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center justify-between gap-2 h-10 group-data-[collapsible=icon]:justify-center  group-data-[collapsible=icon]:py-4">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <Image
              src="/blikka-logo.svg"
              alt="Blikka Logo"
              width={20}
              height={20}
              className="h-5 w-auto"
            />
            <span className="text-2xl text-brand-black/90 font-gothic font-extrabold tracking-wide group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:opacity-0 transition-opacity duration-300 opacity-100">
              blikka
            </span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:opacity-0 transition-opacity duration-300 opacity-100">
            <SidebarTrigger />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}
