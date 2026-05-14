import { describe, expect, it } from "vitest";
import { hasExifFields, mergeExifStates } from "./exif-utils";

describe("hasExifFields", () => {
  it("returns false for empty or missing exif", () => {
    expect(hasExifFields(null)).toBe(false);
    expect(hasExifFields(undefined)).toBe(false);
    expect(hasExifFields({})).toBe(false);
  });

  it("returns true for non-empty exif", () => {
    expect(hasExifFields({ Make: "Canon" })).toBe(true);
  });
});

describe("mergeExifStates", () => {
  it("preserves seeded fields when parsed exif has overlapping keys", () => {
    expect(
      mergeExifStates(
        { Make: "Apple", Model: "iPhone 15 Pro", LensModel: "Main Camera" },
        { Make: "Converted", LensModel: "JPEG Lens", ImageWidth: 4032 },
      ),
    ).toEqual({
      Make: "Apple",
      Model: "iPhone 15 Pro",
      LensModel: "Main Camera",
      ImageWidth: 4032,
    });
  });
});
