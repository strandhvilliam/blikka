"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarMenuItem,
  SidebarMenu,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useSession } from "@/lib/auth/client"
import type { Marathon } from "@blikka/db"
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Calendar,
  ChevronsUpDown,
  CreditCard,
  File,
  Frame,
  Heart,
  Images,
  LayoutDashboard,
  ListCheck,
  LogOut,
  LucideIcon,
  Settings,
  Shield,
  Sparkles,
  Tag,
  Trophy,
  Users,
  Vote,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@radix-ui/react-avatar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@radix-ui/react-separator"
import { useDomain } from "@/lib/domain-provider"
import { formatDomainPathname } from "@/lib/utils"
import Image from "next/image"

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

export function DashboardSidebarHeader() {
  return (
    <SidebarHeader className="px-4 group-data-[collapsible=icon]:p-2">
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center justify-between gap-2 h-10 group-data-[collapsible=icon]:justify-center  group-data-[collapsible=icon]:py-4">
          <div className="flex items-center gap-2 ">
            <Image
              src="/blikka-logo.svg"
              alt="Blikka Logo"
              width={20}
              height={20}
              className="h-5 w-auto"
            />
          </div>
          <div className="group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:opacity-0 transition-opacity duration-300 opacity-100">
            <SidebarTrigger />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

interface DomainSwitcherProps {
  marathons: Marathon[]
  activeDomain: string | undefined
}

export function DomainSwitchDropdown({
  marathons,
  activeDomain,
}: DomainSwitcherProps) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [hasImageError, setHasImageError] = useState(false)

  const activeMarathon = marathons.find(
    (marathon) => marathon.domain === activeDomain,
  )

  const handleImageError = () => {
    setHasImageError(true)
  }

  const handleImageLoad = () => {
    setHasImageError(false)
  }

  const handleSwitchMarathon = () => {
    router.push("/admin/")
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground bg-muted border border-border rounded-xl"
        >
          <div className="flex aspect-square size-8 overflow-hidden items-center justify-center rounded-lg bg-muted border-border border-2">
            {activeMarathon?.logoUrl && !hasImageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeMarathon.logoUrl}
                alt="Marathon logo"
                className="object-cover"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
            ) : (
              <Frame className="size-4" />
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {activeMarathon?.name}
            </span>
            <span className="truncate text-xs">
              {activeMarathon?.startDate
                ? format(activeMarathon.startDate, "d MMMM yyyy")
                : "Date not set"}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto" />
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        align="start"
        side={isMobile ? "bottom" : "right"}
        sideOffset={4}
      >
        {activeMarathon ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-muted border-border overflow-hidden border-2 ">
                {activeMarathon.logoUrl && !hasImageError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeMarathon.logoUrl}
                    alt="Marathon logo"
                    className="object-cover"
                    onError={handleImageError}
                    onLoad={handleImageLoad}
                  />
                ) : (
                  <Frame className="size-8" />
                )}
              </div>
              <div>
                <h3 className="font-gothic text-lg font-semibold">
                  {activeMarathon.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeMarathon.domain}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {activeMarathon.description && (
                <p className="text-sm text-muted-foreground">
                  {activeMarathon.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="size-4" />
                <span>
                  {activeMarathon.startDate
                    ? format(new Date(activeMarathon.startDate), "d MMMM yyyy")
                    : "Date not set"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Users className="size-4" />
                <span>Domain: {activeMarathon.domain}</span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleSwitchMarathon}
              className="w-full"
            >
              Switch Marathon
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              No marathon selected
            </p>
            <Button onClick={handleSwitchMarathon} className="mt-2">
              Select Marathon
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

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
      icon: Heart as LucideIcon,
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

export function SidebarNavUser() {
  const { data: session } = useSession()
  const user = session?.user
  const { isMobile } = useSidebar()
  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback className="rounded-lg">CN</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="truncate text-xs">{user.email}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback className="rounded-lg">CN</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Sparkles />
            Upgrade to Pro
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheck />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
