import type { Marathon, Topic } from "@blikka/db"

import {
  getByCameraSubmissionWindowState,
  type ByCameraSubmissionWindowState,
} from "./by-camera-submission-window-state"

type ByCameraExportMarathon = Pick<Marathon, "mode"> & {
  topics: Topic[]
}

type ByCameraExportMessage = {
  title: string
  description: string
}

export interface ByCameraExportAccessResult {
  activeTopic: Topic | null
  isExportAllowed: boolean
  message: ByCameraExportMessage | null
  state: ByCameraSubmissionWindowState
}

export function getByCameraExportAccessState(
  marathon: ByCameraExportMarathon,
  now = new Date(),
): ByCameraExportAccessResult {
  const activeTopic =
    marathon.mode === "by-camera"
      ? marathon.topics.find((topic) => topic.visibility === "active") ?? null
      : null

  const state = getByCameraSubmissionWindowState(activeTopic, now)

  switch (state) {
    case "no-active-topic":
      return {
        activeTopic,
        isExportAllowed: false,
        message: {
          title: "Exports unavailable",
          description:
            "Activate a topic in Topics before downloading by-camera exports.",
        },
        state,
      }
    case "not-opened":
      return {
        activeTopic,
        isExportAllowed: false,
        message: {
          title: "Schedule required",
          description:
            "Set a scheduled start time for the active topic before downloading exports.",
        },
        state,
      }
    case "open":
      return {
        activeTopic,
        isExportAllowed: false,
        message: {
          title: "Exports unavailable",
          description:
            "Exports are disabled while the active topic is open for submissions.",
        },
        state,
      }
    case "scheduled":
    case "closed":
      return {
        activeTopic,
        isExportAllowed: true,
        message: null,
        state,
      }
  }
}
