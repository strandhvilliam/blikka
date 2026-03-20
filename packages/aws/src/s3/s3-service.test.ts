import { describe, expect, it, vi } from "vitest"

import {
  createSubmissionObjectKey,
  resolveSubmissionContentType,
  resolveSubmissionExtension,
} from "./s3-service"

describe("submission object key helpers", () => {
  it("keeps known image content types", () => {
    expect(resolveSubmissionContentType("image/png")).toBe("image/png")
    expect(resolveSubmissionContentType("image/webp")).toBe("image/webp")
  })

  it("falls back to jpeg for unknown or missing content types", () => {
    expect(resolveSubmissionContentType(undefined)).toBe("image/jpeg")
    expect(resolveSubmissionContentType("application/octet-stream")).toBe("image/jpeg")
  })

  it("maps normalized content types to file extensions", () => {
    expect(resolveSubmissionExtension("image/jpeg")).toBe("jpg")
    expect(resolveSubmissionExtension("image/heic")).toBe("heic")
    expect(resolveSubmissionExtension("image/heif")).toBe("heif")
  })

  it("builds submission keys with the resolved file extension", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-20T10:11:12.345Z"))

    expect(
      createSubmissionObjectKey({
        domain: "demo",
        reference: "AB12",
        orderIndex: 3,
        contentType: "image/png",
      }),
    ).toBe("demo/AB12/04/AB12_04_2026-03-20T10-11-12-345Z.png")

    expect(
      createSubmissionObjectKey({
        domain: "demo",
        reference: "AB12",
        orderIndex: 1,
        filenamePrefix: "replace",
        contentType: "image/heic",
      }),
    ).toBe("demo/AB12/02/replace_AB12_02_2026-03-20T10-11-12-345Z.heic")

    vi.useRealTimers()
  })
})
