"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Handshake, type LucideIcon } from "lucide-react"
import {
  BookOpen,
  File,
  Heart,
  Images,
  LayoutDashboard,
  ListCheck,
  Settings,
  Shield,
  Tag,
  Trophy,
  Vote,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Separator } from "@radix-ui/react-separator"
import { useDomain } from "@/lib/domain-provider"
import { formatDomainPathname } from "@/lib/utils"

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
      icon: File as LucideIcon,
    },
    {
      name: "Staff",
      url: "/dashboard/staff",
      icon: Shield as LucideIcon,
    },
    {
      name: "Jury",
      url: "/dashboard/jury",
      icon: Trophy as LucideIcon,
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
      icon: ListCheck as LucideIcon,
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
      name: "Settings",
      url: "/dashboard/settings",
      icon: Settings as LucideIcon,
    },
  ],
} as const

export default function SidebarLinks() {
  const pathname = usePathname()
  const domain = useDomain()

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
          {NAV_LINKS.marathon.map((item) => {
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
