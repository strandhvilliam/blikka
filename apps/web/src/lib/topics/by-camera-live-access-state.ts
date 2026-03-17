import type {
  CompetitionClass,
  DeviceGroup,
  Marathon,
  Topic,
} from "@blikka/db";

import { getByCameraSubmissionWindowState } from "./by-camera-submission-window-state";

export type ByCameraLiveAccessState =
  | "not-configured"
  | "not-opened"
  | "scheduled"
  | "open"
  | "closed";

export type ByCameraLiveAccessReason =
  | "setup-incomplete"
  | "missing-device-groups"
  | "missing-single-photo-class"
  | "no-active-topic"
  | "missing-scheduled-start"
  | "scheduled"
  | "open"
  | "closed";

type ByCameraLiveTopic = Pick<
  Topic,
  | "id"
  | "name"
  | "orderIndex"
  | "visibility"
  | "scheduledStart"
  | "scheduledEnd"
>;

type ByCameraLiveMarathon = Pick<Marathon, "setupCompleted"> & {
  deviceGroups: Pick<DeviceGroup, "id">[];
  competitionClasses: Pick<CompetitionClass, "id" | "numberOfPhotos">[];
  topics: ByCameraLiveTopic[];
};

export interface ByCameraLiveAccessResult {
  state: ByCameraLiveAccessState;
  reason: ByCameraLiveAccessReason;
  activeTopic: ByCameraLiveTopic | null;
}

export function getByCameraLiveAccessState(
  marathon: ByCameraLiveMarathon,
  now = new Date(),
): ByCameraLiveAccessResult {
  if (!marathon.setupCompleted) {
    return {
      state: "not-configured",
      reason: "setup-incomplete",
      activeTopic: null,
    };
  }

  if (marathon.deviceGroups.length === 0) {
    return {
      state: "not-configured",
      reason: "missing-device-groups",
      activeTopic: null,
    };
  }

  const hasSinglePhotoClass = marathon.competitionClasses.some(
    (competitionClass) => competitionClass.numberOfPhotos === 1,
  );

  if (!hasSinglePhotoClass) {
    return {
      state: "not-configured",
      reason: "missing-single-photo-class",
      activeTopic: null,
    };
  }

  const activeTopic =
    marathon.topics.find((topic) => topic.visibility === "active") ?? null;
  const submissionWindowState = getByCameraSubmissionWindowState(
    activeTopic,
    now,
  );

  switch (submissionWindowState) {
    case "no-active-topic":
      return {
        state: "not-opened",
        reason: "no-active-topic",
        activeTopic,
      };
    case "not-opened":
      return {
        state: "not-opened",
        reason: "missing-scheduled-start",
        activeTopic,
      };
    case "scheduled":
      return {
        state: "scheduled",
        reason: "scheduled",
        activeTopic,
      };
    case "closed":
      return {
        state: "closed",
        reason: "closed",
        activeTopic,
      };
    case "open":
      return {
        state: "open",
        reason: "open",
        activeTopic,
      };
  }
}
