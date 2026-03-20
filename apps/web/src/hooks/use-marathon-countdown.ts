import { differenceInSeconds } from "date-fns"
import { useEffect, useState } from "react"

import { useMarathonConfiguration } from "@/hooks/use-marathon-configuration"

export type MarathonStatus = "not-setup" | "upcoming" | "live" | "ended"

function formatCountdown(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (seconds >= 86400) {
    return `${days}d ${hours.toString().padStart(2, "0")}h`
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
}

export function useMarathonCountdown(domain: string) {
  const { marathon, isConfigured: isSetupComplete } = useMarathonConfiguration(domain)

  const [countdown, setCountdown] = useState<string>("00:00:00")
  const [status, setStatus] = useState<MarathonStatus>("upcoming")

  useEffect(() => {
    const updateCountdownAndStatus = () => {
      const now = new Date()

      if (!isSetupComplete) {
        setStatus("not-setup")
        setCountdown("00:00:00")
        return
      }

      if (!marathon?.startDate || !marathon?.endDate) {
        setStatus("upcoming")
        setCountdown("00:00:00")
        return
      }

      const startDate = new Date(marathon.startDate)
      const endDate = new Date(marathon.endDate)

      if (now < startDate) {
        setStatus("upcoming")
        const secondsUntilStart = differenceInSeconds(startDate, now)
        setCountdown(formatCountdown(Math.max(0, secondsUntilStart)))
      } else if (now >= startDate && now <= endDate) {
        setStatus("live")
        const secondsUntilEnd = differenceInSeconds(endDate, now)
        setCountdown(formatCountdown(Math.max(0, secondsUntilEnd)))
      } else {
        setStatus("ended")
        setCountdown("00:00:00")
      }
    }

    updateCountdownAndStatus()

    const interval = setInterval(updateCountdownAndStatus, 1000)

    return () => clearInterval(interval)
  }, [marathon, isSetupComplete])

  return { countdown, status }
}
