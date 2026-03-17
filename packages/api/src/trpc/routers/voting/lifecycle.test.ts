import { describe, expect, it } from "vitest"

import {
  getVotingLifecycleState,
  hasSubmissionWindowEnded,
  parseVotingScheduleInput,
} from "./lifecycle"

const now = new Date("2026-03-17T10:00:00.000Z")

describe("voting lifecycle helpers", () => {
  it("accepts open-ended voting schedules", () => {
    expect(
      parseVotingScheduleInput({
        startsAt: "2026-03-17T10:00:00.000Z",
        endsAt: null,
      }),
    ).toEqual({
      startsAtIso: "2026-03-17T10:00:00.000Z",
      endsAtIso: null,
    })
  })

  it("accepts bounded voting schedules", () => {
    expect(
      parseVotingScheduleInput({
        startsAt: "2026-03-17T10:00:00.000Z",
        endsAt: "2026-03-17T12:00:00.000Z",
      }),
    ).toEqual({
      startsAtIso: "2026-03-17T10:00:00.000Z",
      endsAtIso: "2026-03-17T12:00:00.000Z",
    })
  })

  it("rejects invalid or reversed voting schedules", () => {
    expect(() =>
      parseVotingScheduleInput({
        startsAt: "invalid",
        endsAt: null,
      }),
    ).toThrow("Invalid voting timestamp")

    expect(() =>
      parseVotingScheduleInput({
        startsAt: "2026-03-17T10:00:00.000Z",
        endsAt: "2026-03-17T10:00:00.000Z",
      }),
    ).toThrow("endsAt must be later than startsAt")
  })

  it("derives the voting lifecycle state", () => {
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
          endsAt: "2026-03-17T09:30:00.000Z",
        },
        now,
      ),
    ).toBe("ended")
  })

  it("detects when the submission window has ended", () => {
    expect(hasSubmissionWindowEnded(null, now)).toBe(false)
    expect(hasSubmissionWindowEnded("2026-03-17T12:00:00.000Z", now)).toBe(
      false,
    )
    expect(hasSubmissionWindowEnded("2026-03-17T09:00:00.000Z", now)).toBe(
      true,
    )
  })
})
