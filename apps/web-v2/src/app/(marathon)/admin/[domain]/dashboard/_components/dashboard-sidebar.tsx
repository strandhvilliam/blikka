"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarMenuItem,
  SidebarMenu,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Suspense } from "react"

export function DashboardSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-none bg-sidebar z-20">
      <Suspense fallback={<AppSidebarHeaderSkeleton />}>
        <AppSidebarHeader />
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
  const { user } = useSession()
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
