import { differenceInSeconds } from "date-fns"
import { useEffect, useState } from "react"

import { useMarathonConfiguration } from "@/hooks/use-marathon-configuration"

export type MarathonStatus = "not-setup" | "upcoming" | "live" | "ended"

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

export function useMarathonCountdown(domain: string) {
  const { marathon, isConfigured: isSetupComplete } = useMarathonConfiguration(domain)

  const [countdown, setCountdown] = useState<string>("00:00:00")
  const [status, setStatus] = useState<MarathonStatus>("upcoming")

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
      if (!marathon?.startDate || !marathon?.endDate) {
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

  return { countdown, status }
}
