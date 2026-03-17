import { describe, expect, it } from "vitest";
import { getByCameraSubmissionWindowState } from "./by-camera-submission-window-state";

const now = new Date("2026-03-17T10:00:00.000Z");

describe("getByCameraSubmissionWindowState", () => {
  it("returns no-active-topic when there is no active topic", () => {
    expect(getByCameraSubmissionWindowState(null, now)).toBe("no-active-topic");
    expect(
      getByCameraSubmissionWindowState(
        {
          visibility: "public",
          scheduledStart: null,
          scheduledEnd: null,
        },
        now,
      ),
    ).toBe("no-active-topic");
  });

  it("returns not-opened when the active topic has no scheduledStart", () => {
    expect(
      getByCameraSubmissionWindowState(
        {
          visibility: "active",
          scheduledStart: null,
          scheduledEnd: null,
        },
        now,
      ),
    ).toBe("not-opened");
  });

  it("returns scheduled when the start is in the future", () => {
    expect(
      getByCameraSubmissionWindowState(
        {
          visibility: "active",
          scheduledStart: "2026-03-17T12:00:00.000Z",
          scheduledEnd: null,
        },
        now,
      ),
    ).toBe("scheduled");
  });

  it("returns open when started and not yet ended", () => {
    expect(
      getByCameraSubmissionWindowState(
        {
          visibility: "active",
          scheduledStart: "2026-03-17T08:00:00.000Z",
          scheduledEnd: "2026-03-17T12:00:00.000Z",
        },
        now,
      ),
    ).toBe("open");
  });

  it("returns closed when the end time has passed", () => {
    expect(
      getByCameraSubmissionWindowState(
        {
          visibility: "active",
          scheduledStart: "2026-03-17T08:00:00.000Z",
          scheduledEnd: "2026-03-17T09:00:00.000Z",
        },
        now,
      ),
    ).toBe("closed");
  });
});
