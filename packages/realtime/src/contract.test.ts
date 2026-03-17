import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import {
  RealtimeEventResultPayloadSchema,
  VotingVoteCastPayloadSchema,
  getDomainRealtimeChannel,
  getParticipantRealtimeChannel,
  getRealtimeResultEventName,
  getVotingVoteCastEventName,
} from "./contract"

describe("realtime contract", () => {
  it("builds generic result event names", () => {
    expect(getRealtimeResultEventName("submission-processed")).toBe(
      "event.result.submission-processed",
    )
  })

  it("builds the voting vote-cast event name", () => {
    expect(getVotingVoteCastEventName()).toBe("event.voting.vote-cast")
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

  it("validates voting vote-cast payloads", () => {
    expect(
      Schema.is(VotingVoteCastPayloadSchema)({
        eventId: "42:2026-03-17T12:00:00.000Z",
        domain: "demo",
        topicId: 7,
        sessionId: 42,
        submissionId: 99,
        votedAt: "2026-03-17T12:00:00.000Z",
        participantReference: "1234",
        participantFirstName: "Ada",
        participantLastName: "Lovelace",
        submissionCreatedAt: "2026-03-17T11:00:00.000Z",
        submissionKey: "submission-key",
        submissionThumbnailKey: "thumb-key",
      }),
    ).toBe(true)
  })
})
