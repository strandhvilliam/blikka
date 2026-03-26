import type { Topic } from "@blikka/db"
import { useEffect, useState } from "react"
import { getSubmissionLifecycleState, getVotingLifecycleState } from "@/lib/voting-lifecycle"

type VotingWindow = {
  startsAt: string | null
  endsAt: string | null
}

export type ByCameraPhase =
  | "no-active-topic"
  | "submissions-not-started"
  | "submissions-ongoing"
  | "submissions-ended"
  | "voting-ongoing"
  | "voting-ended"

export function getByCameraPhase(
  topic: Topic | null,
  votingWindow: VotingWindow | null,
  now = new Date(),
): ByCameraPhase {
  if (!topic || topic.visibility !== "active") return "no-active-topic"

  const submissionState = getSubmissionLifecycleState(topic.scheduledStart, topic.scheduledEnd, now)
  if (submissionState === "not-started") return "submissions-not-started"
  if (submissionState === "open") return "submissions-ongoing"

  const votingState = getVotingLifecycleState(votingWindow ?? { startsAt: null, endsAt: null }, now)
  if (votingState === "active") return "voting-ongoing"
  if (votingState === "ended") return "voting-ended"

  return "submissions-ended"
}

export function useByCameraLifecycle(topic: Topic | null, votingWindow: VotingWindow | null) {
  const [phase, setPhase] = useState<ByCameraPhase>(() => getByCameraPhase(topic, votingWindow))

  useEffect(() => {
    setPhase(getByCameraPhase(topic, votingWindow))
    const interval = setInterval(() => setPhase(getByCameraPhase(topic, votingWindow)), 1000)
    return () => clearInterval(interval)
  }, [topic, votingWindow])

  return phase
}
