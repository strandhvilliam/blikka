import { describe, expect, it } from "vitest"

import {
  getSubmissionLifecycleState,
  getVotingLifecycleState,
  getVotingUnavailableReason,
} from "./voting-lifecycle"

const now = new Date("2026-03-17T10:00:00.000Z")

describe("web voting lifecycle helpers", () => {
  it("treats missing or future starts as not started", () => {
    expect(
      getVotingLifecycleState(
        {
          startsAt: null,
          endsAt: null,
        },
        now,
      ),
    ).toBe("not-started")

    expect(
      getVotingLifecycleState(
        {
          startsAt: "2026-03-17T12:00:00.000Z",
          endsAt: null,
        },
        now,
      ),
    ).toBe("not-started")
  })

  it("supports active open-ended and ended voting", () => {
    expect(
      getVotingLifecycleState(
        {
          startsAt: "2026-03-17T09:00:00.000Z",
          endsAt: null,
        },
        now,
      ),
    ).toBe("active")

    expect(
      getVotingLifecycleState(
        {
          startsAt: "2026-03-17T09:00:00.000Z",
          endsAt: "2026-03-17T09:15:00.000Z",
        },
        now,
      ),
    ).toBe("ended")
  })

  it("returns redirect reasons for unavailable voting", () => {
    expect(
      getVotingUnavailableReason(
        {
          startsAt: "2026-03-17T12:00:00.000Z",
          endsAt: null,
        },
        now,
      ),
    ).toBe("not-started")

    expect(
      getVotingUnavailableReason(
        {
          startsAt: "2026-03-17T09:00:00.000Z",
          endsAt: "2026-03-17T09:15:00.000Z",
        },
        now,
      ),
    ).toBe("ended")
  })

  it("treats missing or future scheduledStart as not-started", () => {
    expect(getSubmissionLifecycleState(null, null, now)).toBe("not-started")
    expect(
      getSubmissionLifecycleState("2026-03-17T12:00:00.000Z", null, now),
    ).toBe("not-started")
  })

  it("tracks whether the submission window is open or ended", () => {
    expect(
      getSubmissionLifecycleState("2026-03-17T08:00:00.000Z", null, now),
    ).toBe("open")
    expect(
      getSubmissionLifecycleState("2026-03-17T08:00:00.000Z", "2026-03-17T12:00:00.000Z", now),
    ).toBe("open")
    expect(
      getSubmissionLifecycleState("2026-03-17T08:00:00.000Z", "2026-03-17T09:00:00.000Z", now),
    ).toBe("ended")
  })
})
