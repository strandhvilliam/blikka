import { Effect } from "effect";
import { ExifParser } from "@blikka/image-manipulation/exif-parser";
import {
  ADMIN_COMMON_IMAGE_EXTENSIONS,
  type AdminSelectedPhoto,
  type ProcessSelectedFilesResult,
} from "./types";

interface ProcessSelectedFilesInput {
  fileList: FileList | null;
  existingPhotos: AdminSelectedPhoto[];
  maxPhotos: number;
  topicOrderIndexes: number[];
}

interface CandidateFile {
  file: File;
  preconvertedExif: Record<string, unknown> | null;
}

function createPhotoId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  );
}

function isSupportedImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? ADMIN_COMMON_IMAGE_EXTENSIONS.includes(extension) : false;
}

async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const heic2any = await import("heic2any");
    const result = await heic2any.default({
      blob: file,
      toType: "image/jpeg",
      quality: 1,
    });

    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob) {
      return null;
    }

    return new File(
      [blob],
      file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
      { type: "image/jpeg" },
    );
  } catch (error) {
    console.error(`Failed to convert HEIC file ${file.name}:`, error);
    return null;
  }
}

async function parseExifData(
  file: File,
): Promise<Record<string, unknown> | null> {
  try {
    const buffer = await file.arrayBuffer();
    const tags = await Effect.runPromise(
      ExifParser.parse(new Uint8Array(buffer)).pipe(
        Effect.provide(ExifParser.Default),
      ),
    );
    return tags as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getExifDate(exif: Record<string, unknown>): Date | null {
  const dateValue = exif.DateTimeOriginal || exif.CreateDate;
  if (!dateValue || typeof dateValue !== "string") {
    return null;
  }

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function normalizeFiles(files: File[]): Promise<{
  candidates: CandidateFile[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const candidates: CandidateFile[] = [];

  for (const file of files) {
    if (!isSupportedImageFile(file)) {
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

export function reassignPhotoOrderIndexes(
  photos: AdminSelectedPhoto[],
  topicOrderIndexes: number[],
): AdminSelectedPhoto[] {
  return photos.map((photo, index) => ({
    ...photo,
    orderIndex: topicOrderIndexes[index] ?? index,
  }));
}

export function revokePhotoPreviewUrls(photos: AdminSelectedPhoto[]) {
  photos.forEach((photo) => {
    URL.revokeObjectURL(photo.previewUrl);
  });
}

export async function processSelectedFiles({
  fileList,
  existingPhotos,
  maxPhotos,
  topicOrderIndexes,
}: ProcessSelectedFilesInput): Promise<ProcessSelectedFilesResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fileList || fileList.length === 0) {
    return {
      photos: existingPhotos,
      warnings,
      errors: ["No files selected"],
    };
  }

  if (maxPhotos <= 0) {
    return {
      photos: existingPhotos,
      warnings,
      errors: ["Select required class/topic before adding images"],
    };
  }

  const files = Array.from(fileList);
  const { candidates, warnings: normalizationWarnings } =
    await normalizeFiles(files);
  warnings.push(...normalizationWarnings);

  if (candidates.length === 0) {
    return {
      photos: existingPhotos,
      warnings,
      errors: ["No valid image files available"],
    };
  }

  const existingNames = new Set(
    existingPhotos.map((photo) => photo.file.name.toLowerCase()),
  );
  const seenNewNames = new Set<string>();

  const uniqueCandidates = candidates.filter((candidate) => {
    const normalizedName = candidate.file.name.toLowerCase();
    if (existingNames.has(normalizedName)) {
      warnings.push(`${candidate.file.name}: duplicate skipped`);
      return false;
    }

    if (seenNewNames.has(normalizedName)) {
      warnings.push(`${candidate.file.name}: duplicate skipped`);
      return false;
    }

    seenNewNames.add(normalizedName);
    return true;
  });

  const remainingSlots = Math.max(0, maxPhotos - existingPhotos.length);
  if (remainingSlots === 0) {
    warnings.push("Maximum number of images already selected");
    return {
      photos: existingPhotos,
      warnings,
      errors,
    };
  }

  if (uniqueCandidates.length > remainingSlots) {
    warnings.push(`Only ${remainingSlots} additional image(s) accepted`);
  }

  const candidatesToUse = uniqueCandidates.slice(0, remainingSlots);

  const newPhotos = await Promise.all(
    candidatesToUse.map(async (candidate) => {
      const parsedExif = await parseExifData(candidate.file);
      return {
        id: createPhotoId(),
        file: candidate.file,
        exif: candidate.preconvertedExif || parsedExif || {},
        preconvertedExif: candidate.preconvertedExif,
        previewUrl: URL.createObjectURL(candidate.file),
        orderIndex: 0,
      } satisfies AdminSelectedPhoto;
    }),
  );

  const sortedPhotos = [...existingPhotos, ...newPhotos].sort((a, b) => {
    const aDate = getExifDate(a.exif);
    const bDate = getExifDate(b.exif);

    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    return aDate.getTime() - bDate.getTime();
  });

  return {
    photos: reassignPhotoOrderIndexes(sortedPhotos, topicOrderIndexes),
    warnings,
    errors,
  };
}
