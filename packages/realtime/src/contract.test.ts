import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import {
  REALTIME_CHANNEL_ENV,
  REALTIME_EVENT_KEY,
  REALTIME_RESULT_OUTCOME,
  RealtimeEventResultPayloadSchema,
  getDomainRealtimeChannel,
  getParticipantRealtimeChannel,
  getRealtimeResultEventName,
} from "./contract"

describe("realtime contract", () => {
  it("builds generic result event names", () => {
    expect(getRealtimeResultEventName(REALTIME_EVENT_KEY.SUBMISSION_PROCESSED)).toBe(
      "event.result.submission-processed",
    )
  })

  it("validates success and error event result payloads", () => {
    expect(
      Schema.is(RealtimeEventResultPayloadSchema)({
        eventKey: REALTIME_EVENT_KEY.PARTICIPANT_FINALIZED,
        outcome: REALTIME_RESULT_OUTCOME.SUCCESS,
        domain: "demo",
        reference: "1234",
        orderIndex: null,
        timestamp: 100,
        duration: 10,
      }),
    ).toBe(true)

    expect(
      Schema.is(RealtimeEventResultPayloadSchema)({
        eventKey: REALTIME_EVENT_KEY.PARTICIPANT_FINALIZED,
        outcome: REALTIME_RESULT_OUTCOME.ERROR,
        domain: "demo",
        reference: "1234",
        orderIndex: null,
        timestamp: 100,
        duration: 10,
      }),
    ).toBe(false)
  })

  it("generates matching domain and participant channels", () => {
    expect(getDomainRealtimeChannel(REALTIME_CHANNEL_ENV.DEV, "demo")).toBe(
      "dev:demo",
    )
    expect(
      getParticipantRealtimeChannel(REALTIME_CHANNEL_ENV.PROD, "demo", "1234"),
    ).toBe("prod:demo:1234")
  })
})
