import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import {
  RealtimeEventResultPayloadSchema,
  getDomainRealtimeChannel,
  getParticipantRealtimeChannel,
  getRealtimeResultEventName,
} from "./contract"

describe("realtime contract", () => {
  it("builds generic result event names", () => {
    expect(getRealtimeResultEventName("submission-processed")).toBe(
      "event.result.submission-processed",
    )
  })

  it("validates success and error event result payloads", () => {
    expect(
      Schema.is(RealtimeEventResultPayloadSchema)({
        eventKey: "participant-finalized",
        outcome: "success",
        domain: "demo",
        reference: "1234",
        orderIndex: null,
        timestamp: 100,
        duration: 10,
      }),
    ).toBe(true)

    expect(
      Schema.is(RealtimeEventResultPayloadSchema)({
        eventKey: "participant-finalized",
        outcome: "error",
        domain: "demo",
        reference: "1234",
        orderIndex: null,
        timestamp: 100,
        duration: 10,
      }),
    ).toBe(false)
  })

  it("generates matching domain and participant channels", () => {
    expect(getDomainRealtimeChannel("dev", "demo")).toBe(
      "dev:demo",
    )
    expect(
      getParticipantRealtimeChannel("prod", "demo", "1234"),
    ).toBe("prod:demo:1234")
  })
})
