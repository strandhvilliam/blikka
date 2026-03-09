"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  filterDuplicateImageCandidates,
  limitImageCandidates,
} from "@/lib/file-processing";
import { parseExifData } from "@/lib/exif-parsing";
import { usePhotoStore } from "../_lib/photo-store";
import { useHeicStore } from "../_lib/heic-store";
import type { SelectedPhoto } from "../_lib/types";

interface UseSelectFileOptions {
  maxPhotos: number;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}

interface UseSelectFileResult {
  handleFileSelect: (
    fileList: FileList | null,
    replace?: boolean,
  ) => Promise<void>;
}

export function useSelectFile({
  maxPhotos,
  t,
}: UseSelectFileOptions): UseSelectFileResult {
  const photos = usePhotoStore((state) => state.photos);
  const addPhotos = usePhotoStore((state) => state.addPhotos);
  const clearPhotos = usePhotoStore((state) => state.clearPhotos);

  const convertFiles = useHeicStore((state) => state.convertFiles);
  const isCancelling = useHeicStore((state) => state.isCancelling);

  const handleFileSelect = useCallback(
    async (fileList: FileList | null, replace?: boolean) => {
      if (!fileList || fileList.length === 0) {
        toast.error(t("noFilesSelected"));
        return;
      }

      const files = Array.from(fileList);

      const { converted, nonHeic } = await convertFiles(files);

      if (isCancelling) {
        toast.message(t("conversionCancelled"));
        return;
      }

      const allFiles = [...nonHeic, ...converted.map((c) => c.file)];

      if (allFiles.length === 0) {
        toast.error(t("noValidFiles"));
        return;
      }

      // If replace mode, clear existing photos first
      if (replace) {
        clearPhotos();
      }

      const { uniqueCandidates, duplicateFileNames } =
        filterDuplicateImageCandidates(
          allFiles.map((file) => ({ file, preconvertedExif: null })),
          photos.map((photo) => photo.file.name),
        );

      if (duplicateFileNames.length > 0) {
        toast.warning(
          t("duplicatesSkipped", {
            names: duplicateFileNames.join(", "),
          }),
        );
      }

      const remainingSlots = replace ? maxPhotos : maxPhotos - photos.length;

      const { acceptedCandidates, truncatedCount } = limitImageCandidates(
        uniqueCandidates,
        remainingSlots,
      );

      if (truncatedCount > 0) {
        toast.warning(t("tooManyFiles", { max: remainingSlots }));
      }

      const newPhotos: SelectedPhoto[] = await Promise.all(
        acceptedCandidates.map(async ({ file }, index) => {
          const convertedInfo = converted.find(
            (c) => c.file.name === file.name,
          );
          const exif =
            convertedInfo?.preconvertedExif ||
            (await parseExifData(file)) ||
            {};

          return {
            file,
            exif,
            preconvertedExif: convertedInfo?.preconvertedExif || null,
            preview: URL.createObjectURL(file),
            orderIndex: replace ? index : photos.length + index,
          };
        }),
      );

      addPhotos(newPhotos);
    },
    [photos, maxPhotos, convertFiles, isCancelling, addPhotos, clearPhotos, t],
  );

  return {
    handleFileSelect,
  };
}
