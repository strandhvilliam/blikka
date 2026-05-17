import { describe, expect, it } from "vitest"
import { getSeedParticipantNames, getSeedReference, SEED_COMBOS, SEED_PREVIEW } from "./seed-data"

describe("marathon seed data", () => {
  it("builds deterministic participant references", () => {
    expect(getSeedReference(0)).toBe("1001")
    expect(getSeedReference(SEED_PREVIEW.participants - 1)).toBe("1030")
  })

  it("cycles through the expected first-name and last-name combinations", () => {
    expect(getSeedParticipantNames(0)).toEqual({
      firstname: "Janne",
      lastname: "Johansson",
    })
    expect(getSeedParticipantNames(9)).toEqual({
      firstname: "Ludvig",
      lastname: "Johansson",
    })
    expect(getSeedParticipantNames(10)).toEqual({
      firstname: "Janne",
      lastname: "Karlsson",
    })
    expect(getSeedParticipantNames(20)).toEqual({
      firstname: "Janne",
      lastname: "Larsson",
    })
  })

  it("distributes 30 seeded participants across combos using the expected 8/8/7/7 split", () => {
    const counts = Array.from({ length: SEED_PREVIEW.participants }).reduce<Record<string, number>>(
      (accumulator, _, index) => {
        const combo = SEED_COMBOS[index % SEED_COMBOS.length]!
        accumulator[combo.key] = (accumulator[combo.key] ?? 0) + 1
        return accumulator
      },
      {},
    )

    expect(counts).toEqual({
      "mobile-8": 8,
      "mobile-24": 8,
      "camera-8": 7,
      "camera-24": 7,
    })
  })
})
