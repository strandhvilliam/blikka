import type {
  ParticipantSelectedPhoto,
  ProcessSelectedFilesResult,
} from "./types";
import {
  COMMON_IMAGE_EXTENSIONS,
  createClientPhotoId,
  filterDuplicateImageCandidates,
  limitImageCandidates,
  normalizeSelectedImageFiles,
  reassignOrderIndexes,
  revokePreviewUrls,
  sortByExifDate,
} from "@/lib/file-processing";
import { parseExifData } from "@/lib/exif-parsing";

interface ProcessSelectedFilesInput {
  fileList: FileList | File[] | null;
  existingPhotos: ParticipantSelectedPhoto[];
  maxPhotos: number;
  topicOrderIndexes: number[];
}

export function reassignPhotoOrderIndexes(
  photos: ParticipantSelectedPhoto[],
  topicOrderIndexes: number[],
): ParticipantSelectedPhoto[] {
  return reassignOrderIndexes(photos, topicOrderIndexes, (photo, orderIndex) => ({
    ...photo,
    orderIndex,
  }));
}

export function revokePhotoPreviewUrls(photos: ParticipantSelectedPhoto[]) {
  revokePreviewUrls(photos, (photo) => photo.previewUrl);
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

  const files = Array.isArray(fileList) ? fileList : Array.from(fileList);
  const { candidates, warnings: normalizationWarnings } =
    await normalizeSelectedImageFiles(files, COMMON_IMAGE_EXTENSIONS);
  warnings.push(...normalizationWarnings);

  if (candidates.length === 0) {
    return {
      photos: existingPhotos,
      warnings,
      errors: ["No valid image files available"],
    };
  }

  const { uniqueCandidates, duplicateFileNames } =
    filterDuplicateImageCandidates(
      candidates,
      existingPhotos.map((photo) => photo.file.name),
    );
  duplicateFileNames.forEach((fileName) => {
    warnings.push(`${fileName}: duplicate skipped`);
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

  const { acceptedCandidates: candidatesToUse, truncatedCount } =
    limitImageCandidates(uniqueCandidates, remainingSlots);

  if (truncatedCount > 0) {
    warnings.push(`Only ${remainingSlots} additional image(s) accepted`);
  }

  const newPhotos = await Promise.all(
    candidatesToUse.map(async (candidate) => {
      const parsedExif = await parseExifData(candidate.file);
      return {
        id: createClientPhotoId(),
        file: candidate.file,
        exif: candidate.preconvertedExif || parsedExif || {},
        preconvertedExif: candidate.preconvertedExif,
        previewUrl: URL.createObjectURL(candidate.file),
        orderIndex: 0,
      } satisfies ParticipantSelectedPhoto;
    }),
  );

  const sortedPhotos = sortByExifDate(
    [...existingPhotos, ...newPhotos],
    (photo) => photo.exif,
  );

  return {
    photos: reassignPhotoOrderIndexes(sortedPhotos, topicOrderIndexes),
    warnings,
    errors,
  };
}

