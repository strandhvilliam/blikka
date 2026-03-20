import type { Topic } from "@blikka/db"

export type ByCameraSubmissionWindowState =
  | "no-active-topic"
  | "not-opened"
  | "scheduled"
  | "open"
  | "closed"

type TopicTiming = Pick<Topic, "visibility" | "scheduledStart" | "scheduledEnd">

export function getByCameraSubmissionWindowState(
  topic: TopicTiming | null,
  now = new Date(),
): ByCameraSubmissionWindowState {
  if (!topic || topic.visibility !== "active") {
    return "no-active-topic"
  }

  if (!topic.scheduledStart) {
    return "not-opened"
  }

  const start = new Date(topic.scheduledStart)

  if (start > now) {
    return "scheduled"
  }

  if (topic.scheduledEnd) {
    const end = new Date(topic.scheduledEnd)

    if (end <= now) {
      return "closed"
    }
  }

  return "open"
}
