import { describe, expect, it } from "vitest";

import { getByCameraLiveAccessState } from "./by-camera-live-access-state";

const now = new Date("2026-03-17T10:00:00.000Z");

function createTopic(
  overrides: {
    id?: number;
    name?: string;
    orderIndex?: number;
    visibility?: string;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
  } = {},
) {
  return {
    id: 1,
    name: "Topic 1",
    orderIndex: 0,
    visibility: "active" as const,
    scheduledStart: null as string | null,
    scheduledEnd: null as string | null,
    createdAt: "2026-01-01T00:00:00.000Z",
    marathonId: 1,
    updatedAt: null as string | null,
    activatedAt: null as string | null,
    ...overrides,
  };
}

function createMarathon(overrides?: {
  setupCompleted?: boolean;
  deviceGroups?: Array<{ id: number }>;
  competitionClasses?: Array<{ id: number; numberOfPhotos: number }>;
  topics?: Array<ReturnType<typeof createTopic>>;
}) {
  return {
    setupCompleted: true,
    deviceGroups: [{ id: 1 }],
    competitionClasses: [{ id: 1, numberOfPhotos: 1 }],
    topics: [],
    ...overrides,
  };
}

describe("getByCameraLiveAccessState", () => {
  it("returns not-configured when setup is incomplete", () => {
    expect(
      getByCameraLiveAccessState(
        createMarathon({ setupCompleted: false }),
        now,
      ),
    ).toMatchObject({
      state: "not-configured",
      reason: "setup-incomplete",
      activeTopic: null,
    });
  });

  it("returns not-configured when device groups are missing", () => {
    expect(
      getByCameraLiveAccessState(createMarathon({ deviceGroups: [] }), now),
    ).toMatchObject({
      state: "not-configured",
      reason: "missing-device-groups",
      activeTopic: null,
    });
  });

  it("returns not-configured when no single-photo class exists", () => {
    expect(
      getByCameraLiveAccessState(
        createMarathon({
          competitionClasses: [{ id: 2, numberOfPhotos: 3 }],
        }),
        now,
      ),
    ).toMatchObject({
      state: "not-configured",
      reason: "missing-single-photo-class",
      activeTopic: null,
    });
  });

  it("returns not-opened when no active topic exists", () => {
    expect(getByCameraLiveAccessState(createMarathon(), now)).toMatchObject({
      state: "not-opened",
      reason: "no-active-topic",
      activeTopic: null,
    });
  });

  it("returns not-opened when the active topic has no scheduled start", () => {
    expect(
      getByCameraLiveAccessState(
        createMarathon({
          topics: [createTopic({ visibility: "active", scheduledStart: null })],
        }),
        now,
      ),
    ).toMatchObject({
      state: "not-opened",
      reason: "missing-scheduled-start",
    });
  });

  it("returns scheduled when the active topic starts later", () => {
    expect(
      getByCameraLiveAccessState(
        createMarathon({
          topics: [
            createTopic({
              visibility: "active",
              scheduledStart: "2026-03-17T12:00:00.000Z",
              scheduledEnd: null,
            }),
          ],
        }),
        now,
      ),
    ).toMatchObject({
      state: "scheduled",
      reason: "scheduled",
    });
  });

  it("returns open when the active topic has started even without marathon dates", () => {
    expect(
      getByCameraLiveAccessState(
        createMarathon({
          topics: [
            createTopic({
              visibility: "active",
              scheduledStart: "2026-03-17T08:00:00.000Z",
              scheduledEnd: null,
            }),
          ],
        }),
        now,
      ),
    ).toMatchObject({
      state: "open",
      reason: "open",
    });
  });

  it("returns closed when the active topic end has passed", () => {
    expect(
      getByCameraLiveAccessState(
        createMarathon({
          topics: [
            createTopic({
              visibility: "active",
              scheduledStart: "2026-03-17T08:00:00.000Z",
              scheduledEnd: "2026-03-17T09:00:00.000Z",
            }),
          ],
        }),
        now,
      ),
    ).toMatchObject({
      state: "closed",
      reason: "closed",
    });
  });
});
