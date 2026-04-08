import { describe, expect, it } from "vitest"

import {
  hasMissingCapturedAtTimestamp,
  moveItemInArray,
  reassignPhotosToTopicOrder,
} from "./photo-ordering"

describe("photo-ordering", () => {
  it("detects when one or more photos are missing a usable capture timestamp", () => {
    expect(
      hasMissingCapturedAtTimestamp([
        { exif: { DateTimeOriginal: "2024-01-01T10:00:00.000Z" } },
        { exif: { DateTimeDigitized: "2024-01-01T10:05:00.000Z" } },
      ]),
    ).toBe(false)

    expect(
      hasMissingCapturedAtTimestamp([
        { exif: { DateTimeOriginal: "2024-01-01T10:00:00.000Z" } },
        { exif: {} },
      ]),
    ).toBe(true)
  })

  it("reassigns accepted row order onto the topic order indexes", () => {
    const reordered = reassignPhotosToTopicOrder(
      [
        { id: "b", orderIndex: 9 },
        { id: "a", orderIndex: 3 },
        { id: "c", orderIndex: 12 },
      ],
      [4, 8, 12],
    )

    expect(reordered).toEqual([
      { id: "b", orderIndex: 4 },
      { id: "a", orderIndex: 8 },
      { id: "c", orderIndex: 12 },
    ])
  })

  it("moves items up and down while keeping boundaries stable", () => {
    expect(moveItemInArray(["a", "b", "c"], 1, "up")).toEqual(["b", "a", "c"])
    expect(moveItemInArray(["a", "b", "c"], 1, "down")).toEqual(["a", "c", "b"])

    const original = ["a", "b", "c"]

    expect(moveItemInArray(original, 0, "up")).toBe(original)
    expect(moveItemInArray(original, 2, "down")).toBe(original)
  })

  it("does not mutate the original array when calculating a move", () => {
    const original = ["a", "b", "c"]

    const moved = moveItemInArray(original, 2, "up")

    expect(moved).toEqual(["a", "c", "b"])
    expect(original).toEqual(["a", "b", "c"])
  })
})
