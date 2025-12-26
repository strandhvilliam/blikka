"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
} from "@/components/ui/sidebar"
import { useSession } from "@/lib/auth/client"
import { useTRPC } from "@/lib/trpc/client"
import { Marathon } from "@blikka/db"
import { useSuspenseQuery } from "@tanstack/react-query"
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
} from "lucide-react"
import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { Suspense, useState } from "react"
import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
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

export function DashboardSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-none bg-sidebar z-20">
      <Suspense fallback={<DashboardSidebarHeaderSkeleton />}>
        <DashboardSidebarHeader />
      </Suspense>
      <SidebarContent>
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
  const trpc = useTRPC()
  const { domain } = useParams<{ domain: string }>()
  const { data: marathons } = useSuspenseQuery(trpc.marathons.getUserMarathons.queryOptions())

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

export function DashboardSidebarHeaderSkeleton() {
  return (
    <SidebarHeader>
      <Skeleton className="h-12 w-full" />
    </SidebarHeader>
  )
}

interface DomainSwitcherProps {
  marathons: Marathon[]
  activeDomain: string | undefined
}

export function DomainSwitchDropdown({ marathons, activeDomain }: DomainSwitcherProps) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [hasImageError, setHasImageError] = useState(false)

  const activeMarathon = marathons.find((marathon) => marathon.domain === activeDomain)

  const handleImageError = () => {
    setHasImageError(true)
  }

  const handleImageLoad = () => {
    setHasImageError(false)
  }

  const handleSwitchMarathon = () => {
    router.push("/select-domain")
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground bg-muted border border-border"
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
            <span className="truncate font-semibold">{activeMarathon?.name}</span>
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
                <h3 className="font-rocgrotesk text-lg font-semibold">{activeMarathon.name}</h3>
                <p className="text-sm text-muted-foreground">{activeMarathon.domain}</p>
              </div>
            </div>

            <div className="space-y-2">
              {activeMarathon.description && (
                <p className="text-sm text-muted-foreground">{activeMarathon.description}</p>
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

            <Button size="sm" variant="outline" onClick={handleSwitchMarathon} className="w-full">
              Switch Marathon
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No marathon selected</p>
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
      url: "/dashboard",
      icon: LayoutDashboard as LucideIcon,
    },
    {
      name: "Submissions",
      url: "/submissions",
      icon: Images as LucideIcon,
    },
    {
      name: "Alerts",
      url: "/alerts",
      icon: Bell as LucideIcon,
    },
    {
      name: "Export",
      url: "/export",
      icon: File as LucideIcon,
    },
    {
      name: "Staff",
      url: "/staff",
      icon: Shield as LucideIcon,
    },
    {
      name: "Jury",
      url: "/jury",
      icon: Trophy as LucideIcon,
    },
  ],
  configuration: [
    {
      name: "Topics",
      url: "/topics",
      icon: Tag as LucideIcon,
    },
    {
      name: "Classes",
      url: "/classes",
      icon: ListCheck as LucideIcon,
    },
    {
      name: "Rules",
      url: "/rules",
      icon: BookOpen as LucideIcon,
    },
    {
      name: "Settings",
      url: "/settings",
      icon: Settings as LucideIcon,
    },
    {
      name: "Sponsors",
      url: "/sponsors",
      icon: Heart as LucideIcon,
    },
  ],
} as const

export default function SidebarLinks() {
  const pathname = usePathname()

  const isActive = (url: string) => {
    if (url === "/") {
      return pathname === "/"
    }
    return pathname.includes(url)
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Marathon</SidebarGroupLabel>

        <SidebarMenu>
          {NAV_LINKS.marathon.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link prefetch={true} href={`/admin/${item.url}`}>
                  <item.icon />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
      <Separator className="group-data-[collapsible=icon]:block hidden" />
      <SidebarGroup>
        <SidebarGroupLabel>Configuration</SidebarGroupLabel>
        <SidebarMenu>
          {NAV_LINKS.configuration.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link prefetch={true} href={`/admin/${item.url}`}>
                  <item.icon />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
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
