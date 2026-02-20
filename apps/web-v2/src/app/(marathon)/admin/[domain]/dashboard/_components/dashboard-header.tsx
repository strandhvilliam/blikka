"use client"

import { DashboardStatusDisplay, DashboardStatusDisplaySkeleton } from "./dashboard-status-display"
import { DomainSwitchDropdown } from "./domain-switch-dropdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronsUpDown, LinkIcon, TagIcon } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Suspense } from "react"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { toast } from "sonner"
import { cn, formatDomainLink } from "@/lib/utils"


export function DashboardHeader() {
  const domain = useDomain()

  const staffSiteUrl = formatDomainLink(`/staff`, domain)
  const participantSiteUrl = formatDomainLink(`/live`, domain)

  return (
    <div className="z-50 w-full pr-4 bg-sidebar">
      <div className="flex h-14 items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-64">
            <Suspense fallback={<Skeleton className="h-10 w-64" />}>
              <DomainSwitchDropdown />
            </Suspense>
          </div>
          <div className="w-64">
            <Suspense fallback={<Skeleton className="h-10 w-64" />}>
              <DashboardHeaderTopicSwitcher />
            </Suspense>
          </div>
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


function DashboardHeaderTopicSwitcher() {
  const trpc = useTRPC()
  const domain = useDomain()
  const queryClient = useQueryClient()
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    })
  )

  const topics = [...(marathon?.topics ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)
  const activeTopic = topics.find((topic) => topic.visibility === "active") ?? null

  const { mutate: activateTopic, isPending: isActivatingTopic } = useMutation(
    trpc.topics.activate.mutationOptions({
      onSuccess: () => {
        toast.success("Topic activated")
      },
      onError: (error) => {
        toast.error(error.message || "Failed to activate topic")
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
      },
    })
  )

  if (marathon?.mode !== "by-camera") {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground bg-muted border border-border rounded-xl"
        >
          <div className="flex aspect-square size-8 overflow-hidden items-center justify-center rounded-lg bg-muted border-border border-2">
            <TagIcon className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {activeTopic ? activeTopic.name : "No active topic"}
            </span>
            <span className="truncate text-xs">
              {topics.length} {topics.length === 1 ? "topic" : "topics"}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto" />
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Active topic</p>
            <p className="text-xs text-muted-foreground">
              Switch which topic is active for by-camera submissions.
            </p>
          </div>
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No topics available yet.</p>
          ) : (
            <div className="space-y-1">
              {topics.map((topic) => {
                const isActive = topic.id === activeTopic?.id

                return (
                  <Button
                    key={topic.id}
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-auto w-full justify-between rounded-lg border px-3 py-2 transition-all",
                      isActive
                        ? "border-[#FE3923]/40 bg-[#FF5D4B]/10 shadow-[0_0_0_1px_rgba(255,93,75,0.25)] hover:bg-[#FF5D4B]/15"
                        : "border-transparent hover:border-[#FE3923]/30 hover:bg-[#FF5D4B]/5"
                    )}
                    onClick={() => {
                      if (isActive) return
                      activateTopic({ domain, id: topic.id })
                    }}
                    disabled={isActivatingTopic}
                  >
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium">{topic.name}</p>
                      <p className="text-xs text-muted-foreground">Topic #{topic.orderIndex + 1}</p>
                    </div>
                    {isActive ? (
                      <Badge
                        variant="outline"
                        className="border-[#FE3923]/40 bg-[#FF5D4B]/10 text-[#E32D18]"
                      >
                        Active
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Set active</span>
                    )}
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
