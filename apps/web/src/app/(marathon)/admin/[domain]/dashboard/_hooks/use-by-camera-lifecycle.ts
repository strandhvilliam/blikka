import type { Topic } from "@blikka/db"
import { useEffect, useState } from "react"
import {
  getSubmissionLifecycleState,
  getVotingLifecycleState,
} from "@/lib/voting/voting-lifecycle"

export type ByCameraPhase =
  | "no-active-topic"
  | "submissions-not-started"
  | "submissions-ongoing"
  | "submissions-ended"
  | "voting-ongoing"
  | "voting-ended"

export function getByCameraPhase(topic: Topic | null, now = new Date()): ByCameraPhase {
  if (!topic || topic.visibility !== "active") return "no-active-topic"

  const submissionState = getSubmissionLifecycleState(
    topic.scheduledStart,
    topic.scheduledEnd,
    now,
  )
  if (submissionState === "not-started") return "submissions-not-started"
  if (submissionState === "open") return "submissions-ongoing"

  const votingState = getVotingLifecycleState(
    { startsAt: topic.votingStartsAt, endsAt: topic.votingEndsAt },
    now,
  )
  if (votingState === "active") return "voting-ongoing"
  if (votingState === "ended") return "voting-ended"

  return "submissions-ended"
}

export function useByCameraLifecycle(topic: Topic | null) {
  const [phase, setPhase] = useState<ByCameraPhase>(() => getByCameraPhase(topic))

  useEffect(() => {
    setPhase(getByCameraPhase(topic))
    const interval = setInterval(() => setPhase(getByCameraPhase(topic)), 1000)
    return () => clearInterval(interval)
  }, [topic])

  return phase
}
