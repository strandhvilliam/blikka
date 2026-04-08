import { describe, expect, it } from "vitest";
import { buildUploadExifPayload } from "./upload-exif";

describe("buildUploadExifPayload", () => {
  it("returns undefined when no preconverted exif is available", () => {
    expect(
      buildUploadExifPayload([
        { preconvertedExif: null },
        { preconvertedExif: {} },
      ]),
    ).toBeUndefined();
  });

  it("preserves array order and null placeholders for non-heic files", () => {
    expect(
      buildUploadExifPayload([
        { preconvertedExif: null },
        { preconvertedExif: { Make: "Apple", Model: "iPhone" } },
      ]),
    ).toEqual([null, { Make: "Apple", Model: "iPhone" }]);
  });
});
