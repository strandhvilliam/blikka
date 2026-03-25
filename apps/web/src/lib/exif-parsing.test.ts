import { afterEach, describe, expect, it, vi } from "vitest";

function mockExifDependencies() {
  vi.doMock("./client-runtime", () => ({
    clientRuntime: {
      runPromise: vi.fn(),
    },
  }));
  vi.doMock("effect", () => ({
    Effect: {
      gen: (fn: () => unknown) => fn(),
    },
  }));
  vi.doMock("@blikka/image-manipulation/exif-parser", () => ({
    ExifParser: {},
  }));
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("effect");
  vi.doUnmock("./client-runtime");
  vi.doUnmock("@blikka/image-manipulation/exif-parser");
});

describe("getExifDate", () => {
  it("returns null for invalid EXIF values", async () => {
    mockExifDependencies();
    const { getExifDate } = await import("./exif-parsing");

    expect(getExifDate()).toBeNull();
    expect(getExifDate({ DateTimeOriginal: 123 })).toBeNull();
    expect(getExifDate({ DateTimeOriginal: "not-a-date" })).toBeNull();
  });

  it("parses DateTimeOriginal and CreateDate values", async () => {
    mockExifDependencies();
    const { getExifDate } = await import("./exif-parsing");

    expect(
      getExifDate({
        DateTimeOriginal: "2024-01-02T03:04:05.000Z",
      })?.toISOString(),
    ).toBe("2024-01-02T03:04:05.000Z");
    expect(
      getExifDate({ CreateDate: "2024-02-03T04:05:06.000Z" })?.toISOString(),
    ).toBe("2024-02-03T04:05:06.000Z");
  });
});

describe("getCapturedAtDate", () => {
  it("returns null for missing or invalid values", async () => {
    mockExifDependencies();
    const { getCapturedAtDate } = await import("./exif-parsing");

    expect(getCapturedAtDate()).toBeNull();
    expect(getCapturedAtDate({ DateTimeDigitized: 123 })).toBeNull();
    expect(getCapturedAtDate({ CreateDate: "invalid" })).toBeNull();
  });

  it("falls back across supported captured-at EXIF fields", async () => {
    mockExifDependencies();
    const { getCapturedAtDate } = await import("./exif-parsing");

    expect(
      getCapturedAtDate({
        DateTimeOriginal: "2024-01-02T03:04:05.000Z",
      })?.toISOString(),
    ).toBe("2024-01-02T03:04:05.000Z");
    expect(
      getCapturedAtDate({
        DateTimeDigitized: "2024-02-03T04:05:06.000Z",
      })?.toISOString(),
    ).toBe("2024-02-03T04:05:06.000Z");
    expect(
      getCapturedAtDate({
        CreateDate: "2024-03-04T05:06:07.000Z",
      })?.toISOString(),
    ).toBe("2024-03-04T05:06:07.000Z");
  });
});

describe("parseExifData", () => {
  it("returns null when EXIF parsing fails", async () => {
    mockExifDependencies();
    vi.doMock("./client-runtime", () => ({
      clientRuntime: {
        runPromise: vi.fn().mockRejectedValue(new Error("parse failed")),
      },
    }));

    const { parseExifData } = await import("./exif-parsing");

    const result = await parseExifData(
      new File(["image"], "photo.jpg", { type: "image/jpeg" }),
    );

    expect(result).toBeNull();
  });
});
