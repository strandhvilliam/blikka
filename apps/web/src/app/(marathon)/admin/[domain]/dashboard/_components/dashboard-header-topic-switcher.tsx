import { useState } from "react"
import type { Topic } from "@blikka/db"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useQueryClient } from "@tanstack/react-query"
import { useSuspenseQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { TagIcon, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { TopicsActivateDialog } from "../topics/_components/topics-activate-dialog"

export function DashboardHeaderTopicSwitcher() {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [pendingTopicToActivate, setPendingTopicToActivate] =
    useState<Topic | null>(null)
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

  const handleTopicClick = (topic: Topic) => {
    if (topic.id === activeTopic?.id) return
    setPopoverOpen(false)
    setPendingTopicToActivate(topic)
  }

  const handleActivateConfirm = (topic: Topic) => {
    activateTopic(
      { domain, id: topic.id },
      {
        onSuccess: () => setPendingTopicToActivate(null),
      },
    )
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
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
                    onClick={() => handleTopicClick(topic)}
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
      <TopicsActivateDialog
        topicToActivate={pendingTopicToActivate}
        activeTopic={activeTopic}
        isOpen={pendingTopicToActivate != null}
        onOpenChange={(open) => !open && setPendingTopicToActivate(null)}
        onConfirm={handleActivateConfirm}
        isPending={isActivatingTopic}
      />
    </Popover>
  )
} 