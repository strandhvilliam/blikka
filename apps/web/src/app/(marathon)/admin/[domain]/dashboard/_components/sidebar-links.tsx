"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Download, FileText, Gavel, Handshake, Layers, type LucideIcon } from "lucide-react"
import {
  BookOpen,
  File,
  Images,
  LayoutDashboard,
  ListCheck,
  Settings,
  Tag,
  Trophy,
  Vote,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Separator } from "@radix-ui/react-separator"
import { useDomain } from "@/lib/domain-provider"
import { formatDomainPathname } from "@/lib/utils"
import { useTRPC } from "@/lib/trpc/client"

export const NAV_LINKS = {
  marathon: [
    {
      name: "Dashboard",
      url: "/dashboard/",
      icon: LayoutDashboard as LucideIcon,
    },
    {
      name: "Submissions",
      url: "/dashboard/submissions",
      icon: Images as LucideIcon,
    },
    {
      name: "Export",
      url: "/dashboard/export",
      icon: Download as LucideIcon,
    },
    {
      name: "Staff",
      url: "/dashboard/staff",
      icon: Users as LucideIcon,
    },
    {
      name: "Jury",
      url: "/dashboard/jury",
      icon: Gavel as LucideIcon,
    },
    {
      name: "Voting",
      url: "/dashboard/voting",
      icon: Vote as LucideIcon,
    },
  ],
  configuration: [
    {
      name: "Topics",
      url: "/dashboard/topics",
      icon: Tag as LucideIcon,
    },
    {
      name: "Classes",
      url: "/dashboard/classes",
      icon: Layers as LucideIcon,
    },
    {
      name: "Rules",
      url: "/dashboard/rules",
      icon: BookOpen as LucideIcon,
    },
    {
      name: "Sponsors",
      url: "/dashboard/sponsors",
      icon: Handshake as LucideIcon,
    },
    {
      name: "Terms",
      url: "/dashboard/terms",
      icon: FileText as LucideIcon,
    },
    {
      name: "Settings",
      url: "/dashboard/settings",
      icon: Settings as LucideIcon,
    },
  ],
} as const

export default function SidebarLinks() {
  const pathname = usePathname()
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  )

  const marathonNavItems = NAV_LINKS.marathon.filter((item) => {
    if (marathon.mode === "by-camera" && item.url === "/dashboard/jury") {
      return false
    }
    if (marathon.mode === "marathon" && item.url === "/dashboard/voting") {
      return false
    }
    return true
  })

  const isActive = (url: string) => {
    const formattedUrl = formatDomainPathname(`/admin${url}`, domain)
    if (url === "/dashboard/") {
      const normalizedPathname = pathname.replace(/\/$/, "")
      const normalizedFormattedUrl = formattedUrl.replace(/\/$/, "")
      return normalizedPathname === normalizedFormattedUrl
    }
    return pathname.startsWith(formattedUrl)
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
          Marathon
        </SidebarGroupLabel>

        <SidebarMenu>
          {marathonNavItems.map((item) => {
            const href = formatDomainPathname(`/admin${item.url}`, domain)
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <Link prefetch={true} href={href}>
                    <item.icon />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
      <Separator className="group-data-[collapsible=icon]:block hidden" />
      <SidebarGroup>
        <SidebarGroupLabel>Configuration</SidebarGroupLabel>
        <SidebarMenu>
          {NAV_LINKS.configuration.map((item) => {
            const href = formatDomainPathname(`/admin${item.url}`, domain)
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <Link prefetch={true} href={href}>
                    <item.icon />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}
