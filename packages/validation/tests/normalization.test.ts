import { describe, expect, it } from "vitest";
import { normalizeAllowedFileTypes } from "../src/utils";

describe("normalizeAllowedFileTypes", () => {
  it("canonicalizes jpeg to jpg", () => {
    expect(normalizeAllowedFileTypes(["jpeg"])).toEqual(["jpg"]);
  });

  it("deduplicates jpg and jpeg aliases", () => {
    expect(normalizeAllowedFileTypes(["jpg", "jpeg", "png"])).toEqual([
      "jpg",
      "png",
    ]);
  });
});
