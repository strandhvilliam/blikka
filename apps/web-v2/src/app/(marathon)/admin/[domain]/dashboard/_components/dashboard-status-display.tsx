"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { differenceInSeconds } from "date-fns"
import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { checkIfMarathonIsProperlyConfigured } from "@/lib/check-marathon-is-configured"

interface RequiredAction {
  action: string
  description: string
}

interface DashboardStatusDisplayProps {
  domain: string
}

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
  const [status, setStatus] = useState<"not-setup" | "upcoming" | "live" | "ended">("upcoming")

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

  return (
    <div className="flex items-center gap-4">
      {status === "not-setup" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Setup Required
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h4 className="font-semibold">Marathon Setup Incomplete</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                The following items need to be configured before the marathon can go live:
              </p>
              <div className="space-y-2">
                {requiredActions.map((action, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-muted rounded-md">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    <p className="text-sm">{action.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
      {status === "upcoming" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Upcoming</Badge>
          <span className="text-sm font-medium font-mono">{countdown}</span>
        </div>
      )}
      {status === "live" && (
        <div className="flex items-center gap-3">
          <Badge
            variant="default"
            className="bg-vimmer-primary hover:bg-vimmer-primary/80 text-white font-bold px-3 py-1 text-sm animate-pulse"
          >
            🔴 LIVE
          </Badge>
          <div className="flex flex-col">
            <span className="text-lg font-bold font-mono text-vimmer-primary">{countdown}</span>
          </div>
        </div>
      )}
      {status === "ended" && <Badge variant="secondary">Ended</Badge>}
    </div>
  )
}

export function DashboardStatusDisplaySkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary">Loading...</Badge>
    </div>
  )
}
