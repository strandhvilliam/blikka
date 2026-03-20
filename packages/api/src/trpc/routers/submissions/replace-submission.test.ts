import { describe, expect, it } from "vitest"

import {
  AdminReplaceSubmissionError,
  assertReplaceTargetMatchesSubmission,
  makeThumbnailKey,
  parseSubmissionStorageKey,
} from "./replace-submission"

describe("replace submission helpers", () => {
  it("parses submission storage keys", () => {
    expect(parseSubmissionStorageKey("demo/REF123/03/file.png")).toEqual({
      domain: "demo",
      reference: "REF123",
      orderIndex: 2,
      fileName: "file.png",
    })
  })

  it("builds thumbnail keys for the same slot", () => {
    expect(
      makeThumbnailKey({
        domain: "demo",
        reference: "REF123",
        orderIndex: 2,
        fileName: "replace_REF123_03.png",
      }),
    ).toBe("demo/REF123/03/thumbnail_replace_REF123_03.png")
  })

  it("rejects invalid storage keys", () => {
    expect(() => parseSubmissionStorageKey("demo/REF123")).toThrow(AdminReplaceSubmissionError)
  })

  it("rejects keys that target a different participant or slot", () => {
    expect(() =>
      assertReplaceTargetMatchesSubmission({
        parsedKey: {
          domain: "other",
          reference: "REF999",
          orderIndex: 4,
          fileName: "file.jpg",
        },
        expectedDomain: "demo",
        expectedReference: "REF123",
        expectedOrderIndex: 2,
      }),
    ).toThrow("Replacement upload target does not match submission slot")
  })

  it("accepts keys that point at the same participant slot", () => {
    expect(() =>
      assertReplaceTargetMatchesSubmission({
        parsedKey: {
          domain: "demo",
          reference: "REF123",
          orderIndex: 2,
          fileName: "file.jpg",
        },
        expectedDomain: "demo",
        expectedReference: "REF123",
        expectedOrderIndex: 2,
      }),
    ).not.toThrow()
  })
})
