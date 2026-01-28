"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { usePhotoStore } from "../_lib/photo-store";
import { useHeicStore } from "../_lib/heic-store";
import { parseExifData } from "../_lib/utils";
import type { SelectedPhoto } from "../_lib/types";

interface UseSelectFileOptions {
  maxPhotos: number;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}

interface UseSelectFileResult {
  handleFileSelect: (fileList: FileList | null) => Promise<void>;
}

export function useSelectFile({
  maxPhotos,
  t,
}: UseSelectFileOptions): UseSelectFileResult {
  const photos = usePhotoStore((state) => state.photos);
  const addPhotos = usePhotoStore((state) => state.addPhotos);
  
  const convertFiles = useHeicStore((state) => state.convertFiles);
  const isCancelling = useHeicStore((state) => state.isCancelling);

  const handleFileSelect = useCallback(
    async (fileList: FileList | null) => {
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

      const existingNames = new Set(photos.map((p) => p.file.name));
      const duplicates = allFiles.filter((f) => existingNames.has(f.name));
      if (duplicates.length > 0) {
        toast.warning(
          t("duplicatesSkipped", {
            names: duplicates.map((f) => f.name).join(", "),
          }),
        );
      }

      const uniqueFiles = allFiles.filter((f) => !existingNames.has(f.name));
      const remainingSlots = maxPhotos - photos.length;

      if (uniqueFiles.length > remainingSlots) {
        toast.warning(t("tooManyFiles", { max: remainingSlots }));
      }

      const newPhotos: SelectedPhoto[] = await Promise.all(
        uniqueFiles.slice(0, remainingSlots).map(async (file, index) => {
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
            orderIndex: photos.length + index,
          };
        }),
      );

      addPhotos(newPhotos);
    },
    [photos, maxPhotos, convertFiles, isCancelling, addPhotos, t],
  );

  return {
    handleFileSelect,
  };
}
