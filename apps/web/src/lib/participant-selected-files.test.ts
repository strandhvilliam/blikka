import { afterEach, describe, expect, it, vi } from "vitest";

async function importParticipantSelectedFiles() {
  const parseExifData = vi.fn(async (file: File) => {
    if (file.name === "third.jpg") {
      return { DateTimeOriginal: "2024-03-01T11:00:00.000Z" };
    }

    if (file.name === "first.jpg") {
      return { DateTimeOriginal: "2024-03-01T08:00:00.000Z" };
    }

    return null;
  });

  const createClientPhotoId = vi
    .fn()
    .mockReturnValueOnce("generated-1")
    .mockReturnValueOnce("generated-2")
    .mockReturnValue("generated-next");
  const generateThumbnailUrlWithRetries = vi.fn(
    async (file: File) => `blob:${file.name}`,
  );

  vi.doMock("./exif-parsing", () => ({
    getExifDate: (exif?: Record<string, unknown> | null) => {
      if (!exif) return null;
      const dateValue = exif.DateTimeOriginal || exif.CreateDate;
      if (typeof dateValue !== "string") {
        return null;
      }

      const date = new Date(dateValue);
      return Number.isNaN(date.getTime()) ? null : date;
    },
    parseExifData,
  }));
  vi.doMock("./file-processing", async () => {
    const actual = await vi.importActual<typeof import("./file-processing")>(
      "./file-processing",
    );

    return {
      ...actual,
      createClientPhotoId,
      generateThumbnailUrlWithRetries,
    };
  });

  const participantSelectedFilesModule = await import("./participant-selected-files");

  return {
    ...participantSelectedFilesModule,
    mocks: {
      parseExifData,
      createClientPhotoId,
      generateThumbnailUrlWithRetries,
    },
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("./exif-parsing");
  vi.doUnmock("./file-processing");
});

describe("participant-upload/participant-selected-files", () => {
  it("prepares selected photos with thumbnails, preserved EXIF, and sorted order indexes", async () => {
    const { prepareParticipantSelectedPhotos, mocks } =
      await importParticipantSelectedFiles();

    const existingPhoto = {
      id: "existing",
      file: new File(["existing"], "existing.jpg", { type: "image/jpeg" }),
      exif: { DateTimeOriginal: "2024-03-01T10:00:00.000Z" },
      previewUrl: "blob:existing",
      orderIndex: 0,
      preconvertedExif: null,
    };

    const result = await prepareParticipantSelectedPhotos({
      candidates: [
        {
          file: new File(["second"], "second.jpg", { type: "image/jpeg" }),
          preconvertedExif: {
            DateTimeOriginal: "2024-03-01T09:00:00.000Z",
          },
        },
        {
          file: new File(["third"], "third.jpg", { type: "image/jpeg" }),
          preconvertedExif: null,
        },
      ],
      existingPhotos: [existingPhoto],
      maxPhotos: 4,
      topicOrderIndexes: [4, 8, 12],
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.photos.map((photo) => photo.file.name)).toEqual([
      "second.jpg",
      "existing.jpg",
      "third.jpg",
    ]);
    expect(result.photos.map((photo) => photo.orderIndex)).toEqual([4, 8, 12]);
    expect(result.photos[0]).toMatchObject({
      id: "generated-1",
      previewUrl: "blob:second.jpg",
      preconvertedExif: {
        DateTimeOriginal: "2024-03-01T09:00:00.000Z",
      },
    });
    expect(result.photos[1]).toMatchObject({
      ...existingPhoto,
      orderIndex: 8,
    });
    expect(result.photos[2]).toMatchObject({
      id: "generated-2",
      previewUrl: "blob:third.jpg",
    });
    expect(mocks.parseExifData).toHaveBeenCalledTimes(1);
    expect(mocks.parseExifData).toHaveBeenCalledWith(
      expect.objectContaining({ name: "third.jpg" }),
    );
    expect(mocks.generateThumbnailUrlWithRetries).toHaveBeenCalledTimes(2);
  });

  it("preserves normalization warnings and enforces duplicate and max-count rules", async () => {
    const { processSelectedFiles, mocks } = await importParticipantSelectedFiles();

    const result = await processSelectedFiles({
      fileList: [
        new File(["notes"], "notes.txt", { type: "text/plain" }),
        new File(["first"], "first.jpg", { type: "image/jpeg" }),
        new File(["duplicate"], "FIRST.JPG", { type: "image/jpeg" }),
        new File(["second"], "second.jpg", { type: "image/jpeg" }),
      ],
      existingPhotos: [
        {
          id: "existing",
          file: new File(["existing"], "existing.jpg", { type: "image/jpeg" }),
          exif: {},
          previewUrl: "blob:existing",
          orderIndex: 0,
          preconvertedExif: null,
        },
      ],
      maxPhotos: 2,
      topicOrderIndexes: [5, 7],
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      "notes.txt: unsupported file type",
      "FIRST.JPG: duplicate skipped",
      "Only 1 additional image(s) accepted",
    ]);
    expect(result.photos).toHaveLength(2);
    expect(result.photos.map((photo) => photo.file.name)).toContain("first.jpg");
    expect(mocks.createClientPhotoId).toHaveBeenCalledTimes(1);
    expect(mocks.generateThumbnailUrlWithRetries).toHaveBeenCalledTimes(1);
    expect(mocks.parseExifData).toHaveBeenCalledTimes(1);
    expect(mocks.parseExifData).toHaveBeenCalledWith(
      expect.objectContaining({ name: "first.jpg" }),
    );
  });

  it("places photos without timestamps last during initial automatic sorting", async () => {
    const { prepareParticipantSelectedPhotos } = await importParticipantSelectedFiles();

    const result = await prepareParticipantSelectedPhotos({
      candidates: [
        {
          file: new File(["known"], "first.jpg", { type: "image/jpeg" }),
          preconvertedExif: null,
        },
        {
          file: new File(["missing"], "missing.jpg", { type: "image/jpeg" }),
          preconvertedExif: {},
        },
      ],
      existingPhotos: [],
      maxPhotos: 2,
      topicOrderIndexes: [2, 4],
    });

    expect(result.photos.map((photo) => photo.file.name)).toEqual([
      "first.jpg",
      "missing.jpg",
    ]);
    expect(result.photos.map((photo) => photo.orderIndex)).toEqual([2, 4]);
  });

  it("bounds concurrent photo preprocessing work", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const parseExifData = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return null;
    });

    vi.doMock("./exif-parsing", () => ({
      getExifDate: () => null,
      parseExifData,
    }));
    vi.doMock("./file-processing", async () => {
      const actual = await vi.importActual<typeof import("./file-processing")>(
        "./file-processing",
      );

      return {
        ...actual,
        createClientPhotoId: vi.fn(() => crypto.randomUUID()),
        generateThumbnailUrlWithRetries: vi.fn(
          async (file: File) => `blob:${file.name}`,
        ),
      };
    });

    const { prepareParticipantSelectedPhotos } = await import(
      "./participant-selected-files"
    );

    await prepareParticipantSelectedPhotos({
      candidates: [
        { file: new File(["one"], "one.jpg", { type: "image/jpeg" }), preconvertedExif: null },
        { file: new File(["two"], "two.jpg", { type: "image/jpeg" }), preconvertedExif: null },
        {
          file: new File(["three"], "three.jpg", { type: "image/jpeg" }),
          preconvertedExif: null,
        },
      ],
      existingPhotos: [],
      maxPhotos: 3,
      topicOrderIndexes: [0, 1, 2],
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
