"use client"

import { Badge } from "@/components/ui/badge"
import { differenceInSeconds } from "date-fns"
import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarClock, Clock3, Radio, Wrench } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { checkIfMarathonIsProperlyConfigured } from "@/lib/check-marathon-is-configured"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

interface RequiredAction {
  action: string
  description: string
}

interface DashboardStatusDisplayProps {
  domain: string
}

type DashboardStatus = "not-setup" | "upcoming" | "live" | "ended"

function formatCountdown(seconds: number) {
  const days = Math.floor(seconds / 86400) // 86400 seconds in a day
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  // If more than 24 hours (1 day), show days and hours
  if (seconds >= 86400) {
    return `${days}d ${hours.toString().padStart(2, "0")}h`
  }

  // Otherwise show hours:minutes:seconds
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
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

function StatusPill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-xs select-none",
        "bg-sidebar-accent/70 text-foreground border-border/60",
        className
      )}
    >
      {children}
    </div>
  )
}

export function DashboardStatusDisplay({ domain }: DashboardStatusDisplayProps) {
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  let isSetupComplete = true
  let requiredActions: Array<{ action: string; description: string }> = []

  if (marathon) {
    const configCheck = checkIfMarathonIsProperlyConfigured({
      marathon,
      deviceGroups: marathon.deviceGroups,
      competitionClasses: marathon.competitionClasses,
      topics: marathon.topics,
    })
    isSetupComplete = configCheck.isConfigured
    requiredActions = configCheck.requiredActions
  }

  const [countdown, setCountdown] = useState<string>("00:00:00")
  const [status, setStatus] = useState<DashboardStatus>("upcoming")

  useEffect(() => {
    const updateCountdownAndStatus = () => {
      const now = new Date()

      // If setup is not complete, show not-setup status
      if (!isSetupComplete) {
        setStatus("not-setup")
        setCountdown("00:00:00")
        return
      }

      // If no dates are provided, default to upcoming
      if (!marathon.startDate || !marathon.endDate) {
        setStatus("upcoming")
        setCountdown("00:00:00")
        return
      }

      const startDate = new Date(marathon.startDate)
      const endDate = new Date(marathon.endDate)

      if (now < startDate) {
        // Marathon hasn't started yet - countdown to start
        setStatus("upcoming")
        const secondsUntilStart = differenceInSeconds(startDate, now)
        setCountdown(formatCountdown(Math.max(0, secondsUntilStart)))
      } else if (now >= startDate && now <= endDate) {
        // Marathon is currently running - countdown to end
        setStatus("live")
        const secondsUntilEnd = differenceInSeconds(endDate, now)
        setCountdown(formatCountdown(Math.max(0, secondsUntilEnd)))
      } else {
        // Marathon has ended
        setStatus("ended")
        setCountdown("00:00:00")
      }
    }

    // Update immediately
    updateCountdownAndStatus()

    // Set up interval to update every second
    const interval = setInterval(updateCountdownAndStatus, 1000)

    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [marathon, isSetupComplete])

  const startDate = marathon?.startDate ? new Date(marathon.startDate) : null
  const endDate = marathon?.endDate ? new Date(marathon.endDate) : null
  const statusMeta = (() => {
    if (status === "not-setup") {
      return {
        label: "Setup required",
        sublabel: `${requiredActions.length} item${requiredActions.length === 1 ? "" : "s"}`,
        toneClass:
          "bg-destructive/10 border-destructive/30 text-destructive dark:bg-destructive/20",
        icon: AlertTriangle,
      }
    }
    if (status === "upcoming") {
      return {
        label: "Upcoming",
        sublabel: "Starts in",
        toneClass: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
        icon: Clock3,
      }
    }
    if (status === "live") {
      return {
        label: "Live",
        sublabel: "Ends in",
        toneClass: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
        icon: Radio,
      }
    }
    return {
      label: "Ended",
      sublabel: "Finished",
      toneClass: "bg-muted border-border/60 text-muted-foreground",
      icon: CalendarClock,
    }
  })()

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
                {status === "live" ? (
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60" />
                    <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                  </span>
                ) : (
                  <StatusIcon className="size-3.5" />
                )}

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
                    status === "ended" && "text-muted-foreground"
                  )}
                >
                  {statusMeta.label}
                </Badge>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Start</span>
                  <span className="font-medium">{startDate ? formatDateTime(startDate) : "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">End</span>
                  <span className="font-medium">{endDate ? formatDateTime(endDate) : "—"}</span>
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
