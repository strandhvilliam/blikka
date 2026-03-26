"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMarathonConfiguration } from "@/hooks/use-marathon-configuration"
import type { RequiredAction } from "@/hooks/use-marathon-configuration"
import { useMarathonCountdown, type MarathonStatus } from "@/hooks/use-marathon-countdown"
import { cn } from "@/lib/utils"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronsUpDown,
  Clock3,
  Loader2,
  Radio,
  TagIcon,
  Vote,
  Wrench,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getVotingLifecycleState, getSubmissionLifecycleState } from "@/lib/voting-lifecycle"
import { type ByCameraPhase, useByCameraLifecycle } from "../_hooks/use-by-camera-lifecycle"

interface DashboardStatusDisplayProps {
  domain: string
}

export function DashboardStatusDisplay({ domain }: DashboardStatusDisplayProps) {
  const { marathon, requiredActions } = useMarathonConfiguration(domain)

  if (!marathon) return null

  if (marathon.mode === "by-camera") {
    return <ByCameraStatusDisplay domain={domain} />
  }

  return <MarathonStatusDisplay domain={domain} requiredActions={requiredActions} />
}

function MarathonStatusDisplay({
  domain,
  requiredActions,
}: {
  domain: string
  requiredActions: RequiredAction[]
}) {
  const { marathon } = useMarathonConfiguration(domain)
  const { countdown, status } = useMarathonCountdown(domain)

  const startDate = marathon?.startDate ? new Date(marathon.startDate) : null
  const endDate = marathon?.endDate ? new Date(marathon.endDate) : null

  const statusMeta = getMarathonStatusMeta(status, requiredActions.length)
  const StatusIcon = statusMeta.icon

  return (
    <div className="flex items-center">
      {status === "not-setup" ? (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="focus-visible:outline-none">
              <StatusPill className={cn("gap-2", statusMeta.toneClass)}>
                <StatusIcon className="size-3.5" />
                <span className="font-semibold">{statusMeta.label}</span>
                <span className="text-[11px] opacity-80">{statusMeta.sublabel}</span>
              </StatusPill>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px]" align="end">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-destructive" />
                    <h4 className="font-semibold">Finish setup to go live</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fix the items below to unlock the countdown and live state.
                  </p>
                </div>
                <Badge variant="destructive">{requiredActions.length}</Badge>
              </div>

              <div className="space-y-2">
                {requiredActions.map((action, index) => (
                  <div
                    key={`${action.action}-${index}`}
                    className="flex items-start gap-3 rounded-md border bg-muted/40 px-3 py-2"
                  >
                    <div className="mt-1 size-2 rounded-full bg-destructive shrink-0" />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{action.description}</div>
                      <div className="text-xs text-muted-foreground">{action.action}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {getSetupLinks(domain, requiredActions).map((link) => {
                  const LinkIcon = link.icon
                  return (
                    <Button key={link.href} asChild variant="secondary" size="sm" className="gap-2">
                      <Link href={link.href}>
                        <LinkIcon className="size-4" />
                        {link.label}
                        <ArrowRight className="size-4 opacity-70" />
                      </Link>
                    </Button>
                  )
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <HoverCard openDelay={150}>
          <HoverCardTrigger asChild>
            <div>
              <StatusPill className={cn("gap-2", statusMeta.toneClass)}>
                {status === "live" ? <PingDot /> : <StatusIcon className="size-3.5" />}

                <span className="font-semibold">{statusMeta.label}</span>

                {status !== "ended" ? (
                  <>
                    <span className="text-[11px] opacity-75">{statusMeta.sublabel}</span>
                    <span className="font-mono tabular-nums text-[12px]">{countdown}</span>
                  </>
                ) : (
                  <span className="text-[11px] opacity-75">{statusMeta.sublabel}</span>
                )}
              </StatusPill>
            </div>
          </HoverCardTrigger>
          <HoverCardContent align="end" className="w-[320px]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusIcon className="size-4" />
                  <div className="font-semibold">Marathon status</div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    status === "live" &&
                      "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
                    status === "upcoming" &&
                      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    status === "ended" && "text-muted-foreground",
                  )}
                >
                  {statusMeta.label}
                </Badge>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Start</span>
                  <span className="font-medium">
                    {startDate ? format(startDate, "MMM dd, HH:mm") : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">End</span>
                  <span className="font-medium">
                    {endDate ? format(endDate, "MMM dd, HH:mm") : "—"}
                  </span>
                </div>
              </div>

              {status !== "ended" ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{statusMeta.sublabel}</span>
                    <span className="font-mono tabular-nums text-sm font-semibold">
                      {countdown}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  )
}
function ByCameraStatusDisplay({ domain }: { domain: string }) {
  const [pendingTopicId, setPendingTopicId] = useState<number | null>(null)
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const topics = [...(marathon?.topics ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)
  const activeTopic = topics.find((t) => t.visibility === "active") ?? null
  const { data: activeVotingSummary } = useQuery({
    ...trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic?.id ?? 0,
    }),
    enabled: activeTopic != null,
  })
  const activeVotingWindow = activeVotingSummary?.votingWindow ?? null
  const pendingTopic = topics.find((topic) => topic.id === pendingTopicId) ?? null
  const phase = useByCameraLifecycle(activeTopic, activeVotingWindow)
  const phaseMeta = getPhaseMeta(phase)
  const PhaseIcon = phaseMeta.icon
  const submissionState = getSubmissionLifecycleState(
    activeTopic?.scheduledStart,
    activeTopic?.scheduledEnd,
  )
  const votingState = getVotingLifecycleState(activeVotingWindow ?? { startsAt: null, endsAt: null })
  const hasOpenSubmissions = submissionState === "open"
  const hasActiveVoting = votingState === "active"

  const invalidateMarathon = async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.marathons.pathKey() })
  }

  const activateTopicMutation = useMutation(
    trpc.topics.activate.mutationOptions({
      onSuccess: () => toast.success("Topic activated"),
      onError: (error) => toast.error(error.message || "Failed to activate topic"),
      onSettled: invalidateMarathon,
    }),
  )

  const endSubmissionsMutation = useMutation(
    trpc.topics.update.mutationOptions({
      onSuccess: () => toast.success("Submissions ended"),
      onError: (error) => toast.error(error.message || "Failed to end submissions"),
      onSettled: invalidateMarathon,
    }),
  )

  const closeVotingMutation = useMutation(
    trpc.voting.closeTopicVotingWindow.mutationOptions({
      onSuccess: () => toast.success("Voting closed"),
      onError: (error) => toast.error(error.message || "Failed to close voting"),
      onSettled: invalidateMarathon,
    }),
  )

  const handleActivateTopic = async (id: number) => {
    await activateTopicMutation.mutateAsync({ domain, id })
  }

  const handleTopicChange = (value: string) => {
    const id = Number(value)
    if (!id || id === activeTopic?.id) {
      return
    }

    if (hasOpenSubmissions || hasActiveVoting) {
      setPendingTopicId(id)
      return
    }

    void handleActivateTopic(id)
  }

  const handleConfirmSwitch = async () => {
    if (!pendingTopicId || !activeTopic) {
      return
    }

    try {
      if (hasOpenSubmissions) {
        await endSubmissionsMutation.mutateAsync({
          domain,
          id: activeTopic.id,
          data: {
            scheduledEnd: new Date().toISOString(),
          },
        })
      } else if (hasActiveVoting) {
        await closeVotingMutation.mutateAsync({
          domain,
          topicId: activeTopic.id,
        })
      }

      await handleActivateTopic(pendingTopicId)
      setPendingTopicId(null)
    } catch {
      // Errors are surfaced by the mutations; keep the dialog open for retry.
    }
  }

  const isSwitchPending =
    activateTopicMutation.isPending ||
    endSubmissionsMutation.isPending ||
    closeVotingMutation.isPending
  const isLive = phase === "submissions-ongoing" || phase === "voting-ongoing"
  const confirmDescription = hasOpenSubmissions
    ? `Switching topics will end submissions for "${activeTopic?.name}" now before activating "${pendingTopic?.name ?? "the selected topic"}".`
    : hasActiveVoting
      ? `Switching topics will close voting for "${activeTopic?.name}" now before activating "${pendingTopic?.name ?? "the selected topic"}".`
      : `Switch to "${pendingTopic?.name ?? "the selected topic"}"?`

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="focus-visible:outline-none">
            <StatusPill className={cn("gap-2 cursor-pointer", phaseMeta.toneClass)}>
              {isLive ? (
                <PingDot color={phaseMeta.pingColor} />
              ) : (
                <PhaseIcon className="size-3.5" />
              )}
              {activeTopic ? (
                <>
                  <span className="font-semibold max-w-[120px] truncate">{activeTopic.name}</span>
                  <span className="text-[10px] opacity-60">·</span>
                </>
              ) : null}
              <span className={cn("text-[11px]", activeTopic ? "opacity-80" : "font-semibold")}>
                {phaseMeta.label}
              </span>
              <ChevronsUpDown className="size-3 opacity-50" />
            </StatusPill>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="end">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/60">
            <span className="text-xs font-medium text-muted-foreground">By-camera mode</span>
            <Badge variant="outline" className={cn("text-[10px] py-0", phaseMeta.badgeClass)}>
              {phaseMeta.label}
            </Badge>
          </div>

          <div className="p-3 space-y-3">
            {activeTopic && (
              <div
                className={cn("rounded-lg border px-3 py-2.5 space-y-1", phaseMeta.cardBorderClass)}
              >
                <div className="flex items-center gap-2">
                  <TagIcon className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{activeTopic.name}</span>
                  <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                    #{activeTopic.orderIndex + 1}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {phaseMeta.description}
                </p>
              </div>
            )}

            {topics.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Switch topic
                </label>
                <Select
                  value={activeTopic ? String(activeTopic.id) : undefined}
                  onValueChange={handleTopicChange}
                  disabled={isSwitchPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a topic…" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={String(topic.id)}>
                        #{topic.orderIndex + 1} — {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {topics.length === 0 && (
              <p className="text-sm text-muted-foreground">No topics created yet.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <AlertDialog
        open={pendingTopicId != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTopicId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch topic?</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSwitchPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmSwitch()
              }}
              disabled={!pendingTopic || isSwitchPending}
            >
              {isSwitchPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Switching...
                </>
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatusPill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-xs select-none",
        "bg-sidebar-accent/70 text-foreground border-border/60",
        className,
      )}
    >
      {children}
    </div>
  )
}

function PingDot({ color = "bg-red-500" }: { color?: string }) {
  return (
    <span className="relative flex size-2">
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
          color,
        )}
      />
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  )
}

export function DashboardStatusDisplaySkeleton() {
  return (
    <div className="flex items-center">
      <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs bg-muted/40 text-muted-foreground animate-pulse">
        <div className="size-3.5 rounded-full bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-3 w-12 rounded bg-muted" />
      </div>
    </div>
  )
}

function getSetupLinks(domain: string, requiredActions: RequiredAction[]) {
  const routeForAction: Record<string, { label: string; href: string; icon: typeof Wrench }> = {
    missing_dates: {
      label: "Open settings",
      href: `/admin/${domain}/dashboard/settings`,
      icon: CalendarClock,
    },
    missing_name: {
      label: "Open settings",
      href: `/admin/${domain}/dashboard/settings`,
      icon: CalendarClock,
    },
    missing_device_groups: {
      label: "Open classes",
      href: `/admin/${domain}/dashboard/classes`,
      icon: Wrench,
    },
    missing_competition_classes: {
      label: "Open classes",
      href: `/admin/${domain}/dashboard/classes`,
      icon: Wrench,
    },
    missing_competition_class_topics: {
      label: "Open classes",
      href: `/admin/${domain}/dashboard/classes`,
      icon: Wrench,
    },
    missing_topics: {
      label: "Open topics",
      href: `/admin/${domain}/dashboard/topics`,
      icon: Wrench,
    },
  }

  const unique = new Map<string, { label: string; href: string; icon: typeof Wrench }>()
  for (const action of requiredActions) {
    const target = routeForAction[action.action]
    if (!target) continue
    unique.set(target.href, target)
  }
  return Array.from(unique.values())
}

function getMarathonStatusMeta(status: MarathonStatus, requiredActionsCount: number) {
  const metaForStatus: Record<
    MarathonStatus,
    { label: string; sublabel: string; toneClass: string; icon: typeof AlertTriangle }
  > = {
    "not-setup": {
      label: "Setup required",
      sublabel: `${requiredActionsCount} item${requiredActionsCount === 1 ? "" : "s"}`,
      toneClass: "bg-destructive/10 border-destructive/30 text-destructive dark:bg-destructive/20",
      icon: AlertTriangle,
    },
    upcoming: {
      label: "Upcoming",
      sublabel: "Starts in",
      toneClass: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
      icon: Clock3,
    },
    live: {
      label: "Live",
      sublabel: "Ends in",
      toneClass: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
      icon: Radio,
    },
    ended: {
      label: "Ended",
      sublabel: "Finished",
      toneClass: "bg-muted border-border/60 text-muted-foreground",
      icon: CalendarClock,
    },
  }
  return metaForStatus[status]
}

function getPhaseMeta(phase: ByCameraPhase) {
  const meta: Record<
    ByCameraPhase,
    {
      label: string
      description: string
      toneClass: string
      badgeClass: string
      cardBorderClass: string
      icon: typeof Clock3
      pingColor: string
    }
  > = {
    "no-active-topic": {
      label: "No active topic",
      description: "Activate a topic to get started.",
      toneClass: "bg-muted border-border/60 text-muted-foreground",
      badgeClass: "text-muted-foreground",
      cardBorderClass: "border-border",
      icon: TagIcon,
      pingColor: "bg-slate-400",
    },
    "submissions-not-started": {
      label: "Awaiting submissions",
      description: "Submissions have not been started yet for this topic.",
      toneClass: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
      badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      cardBorderClass: "border-amber-200 dark:border-amber-800",
      icon: Clock3,
      pingColor: "bg-amber-500",
    },
    "submissions-ongoing": {
      label: "Submissions live",
      description: "Participants are currently submitting photos for this topic.",
      toneClass: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
      badgeClass: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
      cardBorderClass: "border-red-200 dark:border-red-800",
      icon: Radio,
      pingColor: "bg-red-500",
    },
    "submissions-ended": {
      label: "Submissions closed",
      description: "Submission window has ended. Ready to start voting.",
      toneClass: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400",
      badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
      cardBorderClass: "border-blue-200 dark:border-blue-800",
      icon: CheckCircle2,
      pingColor: "bg-blue-500",
    },
    "voting-ongoing": {
      label: "Voting live",
      description: "Voters are currently casting their votes for this topic.",
      toneClass: "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-400",
      badgeClass: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
      cardBorderClass: "border-violet-200 dark:border-violet-800",
      icon: Vote,
      pingColor: "bg-violet-500",
    },
    "voting-ended": {
      label: "Voting complete",
      description: "Voting has concluded for this topic.",
      toneClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
      badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      cardBorderClass: "border-emerald-200 dark:border-emerald-800",
      icon: CheckCircle2,
      pingColor: "bg-emerald-500",
    },
  }
  return meta[phase]
}
