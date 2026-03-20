import { describe, expect, it } from "vitest"

import { resolveReplaceUploadContentType } from "./replace-upload"

describe("resolveReplaceUploadContentType", () => {
  it("keeps supported browser-reported image types", () => {
    expect(resolveReplaceUploadContentType({ type: "image/png", name: "photo.png" })).toBe(
      "image/png",
    )
    expect(resolveReplaceUploadContentType({ type: "image/heic", name: "photo.heic" })).toBe(
      "image/heic",
    )
  })

  it("normalizes image/jpg to image/jpeg", () => {
    expect(resolveReplaceUploadContentType({ type: "image/jpg", name: "photo.jpg" })).toBe(
      "image/jpeg",
    )
  })

  it("falls back to the file extension when the browser omits the mime type", () => {
    expect(resolveReplaceUploadContentType({ type: "", name: "photo.JPEG" })).toBe("image/jpeg")
    expect(resolveReplaceUploadContentType({ type: "", name: "photo.webp" })).toBe("image/webp")
  })

  it("returns null for unsupported files", () => {
    expect(resolveReplaceUploadContentType({ type: "application/pdf", name: "photo.pdf" })).toBe(
      null,
    )
  })
})
