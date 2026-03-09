import { afterEach, describe, expect, it, vi } from "vitest";

function mockExifDependencies() {
  vi.doMock("./client-runtime", () => ({
    clientRuntime: {
      runPromise: vi.fn(),
    },
  }));
  vi.doMock(
    "effect",
    () => ({
      Effect: {
        gen: (fn: () => unknown) => fn(),
      },
    }),
    { virtual: true },
  );
  vi.doMock(
    "@blikka/image-manipulation/exif-parser",
    () => ({
      ExifParser: {},
    }),
    { virtual: true },
  );
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
