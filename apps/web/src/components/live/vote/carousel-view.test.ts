import { describe, expect, it } from "vitest"

import { isSubmissionInRenderWindow } from "./carousel-view"

describe("CarouselView image render window", () => {
  it("only renders images for the current submission and its direct neighbors", () => {
    const indexes = Array.from({ length: 7 }, (_, index) => index)

    expect(indexes.filter((index) => isSubmissionInRenderWindow(index, 3))).toEqual([2, 3, 4])
  })

  it("clamps the image render window at the start of the carousel", () => {
    const indexes = Array.from({ length: 7 }, (_, index) => index)

    expect(indexes.filter((index) => isSubmissionInRenderWindow(index, 0))).toEqual([0, 1])
  })
})
