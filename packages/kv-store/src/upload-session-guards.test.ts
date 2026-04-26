import { describe, expect, it } from "vitest"
import { makeInitialParticipantState } from "./schema"
import {
  getUploadSessionId,
  isCurrentUploadSession,
} from "./upload-session-guards"

describe("upload session guards", () => {
  it("matches the current upload session", () => {
    const participantState = makeInitialParticipantState("session-a", 1, [0])

    expect(
      isCurrentUploadSession({
        eventUploadSessionId: "session-a",
        participantState,
      }),
    ).toEqual({ matched: true })
  })

  it("rejects missing current session ids", () => {
    const participantState = makeInitialParticipantState("", 1, [0])

    expect(
      isCurrentUploadSession({
        eventUploadSessionId: "session-a",
        participantState,
      }),
    ).toEqual({ matched: false, reason: "missing-current-session" })
  })

  it("rejects mismatched session ids", () => {
    const participantState = makeInitialParticipantState("session-b", 1, [0])

    expect(
      isCurrentUploadSession({
        eventUploadSessionId: "session-a",
        participantState,
      }),
    ).toEqual({ matched: false, reason: "session-mismatch" })
  })

  it("normalizes optional session ids to an empty string", () => {
    expect(getUploadSessionId({})).toBe("")
  })
})
