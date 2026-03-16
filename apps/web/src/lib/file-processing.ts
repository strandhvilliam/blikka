import { getExifDate, parseExifData, type ExifData } from "./exif-parsing";

export const COMMON_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "heic",
  "heif",
  "png",
  "gif",
  "webp",
] as const;

export interface NormalizedImageCandidate {
  file: File;
  preconvertedExif: ExifData | null;
}

export function createClientPhotoId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  );
}

export function isSupportedImageFile(
  file: File,
  supportedExtensions: readonly string[] = COMMON_IMAGE_EXTENSIONS,
): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? supportedExtensions.includes(extension) : false;
}

const HEIC_CONVERSION_TIMEOUT_MS = 60_000;

export async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const heic2any = await import("heic2any");

    const conversionPromise = heic2any.default({
      blob: file,
      toType: "image/jpeg",
      quality: 1,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("HEIC conversion timed out")),
        HEIC_CONVERSION_TIMEOUT_MS,
      );
    });

    const result = await Promise.race([conversionPromise, timeoutPromise]);

    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob) {
      return null;
    }

    return new File(
      [blob],
      file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
      {
        type: "image/jpeg",
      },
    );
  } catch (error) {
    console.error(`Failed to convert HEIC file ${file.name}:`, error);
    return null;
  }
}

export async function normalizeSelectedImageFiles(
  files: File[],
  supportedExtensions: readonly string[] = COMMON_IMAGE_EXTENSIONS,
): Promise<{
  candidates: NormalizedImageCandidate[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const candidates: NormalizedImageCandidate[] = [];

  for (const file of files) {
    if (!isSupportedImageFile(file, supportedExtensions)) {
      warnings.push(`${file.name}: unsupported file type`);
      continue;
    }

    if (!isHeicFile(file)) {
      candidates.push({
        file,
        preconvertedExif: null,
      });
      continue;
    }

    const preconvertedExif = await parseExifData(file);
    const converted = await convertHeicToJpeg(file);

    if (!converted) {
      warnings.push(`${file.name}: failed to convert HEIC/HEIF`);
      continue;
    }

    candidates.push({
      file: converted,
      preconvertedExif,
    });
  }

  return { candidates, warnings };
}

export function filterDuplicateImageCandidates(
  candidates: NormalizedImageCandidate[],
  existingFileNames: Iterable<string>,
): {
  uniqueCandidates: NormalizedImageCandidate[];
  duplicateFileNames: string[];
} {
  const seenExisting = new Set(
    Array.from(existingFileNames, (name) => name.toLowerCase()),
  );
  const seenNew = new Set<string>();
  const duplicateFileNames: string[] = [];

  const uniqueCandidates = candidates.filter((candidate) => {
    const normalizedName = candidate.file.name.toLowerCase();

    if (seenExisting.has(normalizedName) || seenNew.has(normalizedName)) {
      duplicateFileNames.push(candidate.file.name);
      return false;
    }

    seenNew.add(normalizedName);
    return true;
  });

  return { uniqueCandidates, duplicateFileNames };
}

export function limitImageCandidates<T>(
  candidates: T[],
  maxCount: number,
): {
  acceptedCandidates: T[];
  truncatedCount: number;
} {
  const acceptedCandidates = candidates.slice(0, Math.max(0, maxCount));
  const truncatedCount = Math.max(
    0,
    candidates.length - acceptedCandidates.length,
  );

  return {
    acceptedCandidates,
    truncatedCount,
  };
}

export function sortByExifDate<T>(
  items: T[],
  getExif: (item: T) => ExifData | null | undefined,
): T[] {
  return [...items].sort((a, b) => {
    const aDate = getExifDate(getExif(a));
    const bDate = getExifDate(getExif(b));

    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    return aDate.getTime() - bDate.getTime();
  });
}

export function reassignOrderIndexes<T>(
  items: T[],
  topicOrderIndexes: number[],
  updater: (item: T, orderIndex: number) => T,
): T[] {
  return items.map((item, index) =>
    updater(item, topicOrderIndexes[index] ?? index),
  );
}

export function revokePreviewUrls<T>(
  items: T[],
  getUrl: (item: T) => string | null | undefined,
) {
  items.forEach((item) => {
    const url = getUrl(item);
    if (url) {
      URL.revokeObjectURL(url);
    }
  });
}

const THUMBNAIL_MAX_DIMENSION = 400;

/**
 * Generates a small thumbnail blob URL from a full-size image file.
 * Uses createImageBitmap with resize for efficient sub-sampled decoding
 * so the browser never needs to fully decode the original resolution.
 * Falls back to a direct object URL if thumbnail generation fails.
 */
export async function generateThumbnailUrl(
  file: File | Blob,
  maxDimension = THUMBNAIL_MAX_DIMENSION,
): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: maxDimension,
      resizeQuality: "medium",
    });

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      bitmap.close();
      return URL.createObjectURL(file);
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.7,
    });
    return URL.createObjectURL(blob);
  } catch {
    return URL.createObjectURL(file);
  }
}
