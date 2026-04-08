"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { prepareParticipantSelectedPhotos } from "@/lib/participant-selected-files";
import { isSupportedImageFile } from "@/lib/file-processing";
import { usePhotoStore } from "@/lib/flow/photo-store";
import { useHeicStore } from "@/lib/flow/heic-store";
import type { SelectedPhoto } from "@/lib/flow/types";
import type { ParticipantSelectedPhoto } from "@/lib/participant-upload-types";
import {
  byCameraBreadcrumb,
  captureByCameraMessage,
  summarizeFileListForSentry,
} from "@/lib/sentry-by-camera";

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
  const setPhotos = usePhotoStore((state) => state.setPhotos);
  const setIsProcessingFiles = usePhotoStore(
    (state) => state.setIsProcessingFiles,
  );
  const topicOrderIndexes = usePhotoStore((state) => state.topicOrderIndexes);

  const convertFiles = useHeicStore((state) => state.convertFiles);
  const selectionGenerationRef = useRef(0);

  const handleFileSelect = useCallback(
    async (fileList: FileList | null, replace?: boolean) => {
      if (!fileList || fileList.length === 0) {
        byCameraBreadcrumb("file_input_empty");
        toast.error(t("noFilesSelected"));
        return;
      }

      const files = Array.from(fileList);
      const generation = ++selectionGenerationRef.current;
      byCameraBreadcrumb("file_select_started", {
        generation,
        replace: Boolean(replace),
        ...summarizeFileListForSentry(files),
      });

      const { converted, nonHeic, cancelled } = await convertFiles(files);

      if (cancelled) {
        byCameraBreadcrumb("heic_conversion_cancelled", { generation });
        toast.message(t("conversionCancelled"));
        return;
      }

      byCameraBreadcrumb("heic_conversion_done", {
        generation,
        convertedCount: converted.length,
        nonHeicCount: nonHeic.length,
      });

      const candidates = [
        ...nonHeic
          .filter((file) => isSupportedImageFile(file))
          .map((file) => ({
            file,
            preconvertedExif: null,
          })),
        ...converted.map((file) => ({
          file: file.file,
          preconvertedExif: file.preconvertedExif ?? null,
        })),
      ];

      if (candidates.length === 0) {
        captureByCameraMessage("by_camera_zero_candidates_after_filter", {
          level: "warning",
          extra: {
            generation,
            ...summarizeFileListForSentry(files),
          },
        });
        toast.error(t("noValidFiles"));
        return;
      }

      setIsProcessingFiles(true);

      try {
        const result = await prepareParticipantSelectedPhotos({
          candidates,
          existingPhotos: (replace ? [] : photos).map(
            (photo): ParticipantSelectedPhoto => ({
              id: photo.id,
              file: photo.file,
              exif: photo.exif,
              previewUrl: photo.preview,
              orderIndex: photo.orderIndex,
              preconvertedExif: photo.preconvertedExif,
            }),
          ),
          maxPhotos,
          topicOrderIndexes,
        });

        if (generation !== selectionGenerationRef.current) {
          byCameraBreadcrumb("file_select_stale_result_dropped", {
            generation,
            latest: selectionGenerationRef.current,
          });
          return;
        }

        byCameraBreadcrumb("prepare_participant_photos_done", {
          generation,
          photoCount: result.photos.length,
          warningCount: result.warnings.length,
          errorCount: result.errors.length,
        });

        const duplicateWarnings = result.warnings.filter((message) =>
          message.endsWith(": duplicate skipped"),
        );
        if (duplicateWarnings.length > 0) {
          toast.warning(
            t("duplicatesSkipped", {
              names: duplicateWarnings
                .map((message) => message.replace(/: duplicate skipped$/, ""))
                .join(", "),
            }),
          );
        }

        if (
          result.warnings.some((message) =>
            message.startsWith("Only ") &&
            message.endsWith(" additional image(s) accepted"),
          )
        ) {
          const remainingSlots = replace ? maxPhotos : maxPhotos - photos.length;
          toast.warning(t("tooManyFiles", { max: remainingSlots }));
        }

        result.errors.forEach((message) => {
          toast.error(message);
        });

        const nextPhotos: SelectedPhoto[] = result.photos.map((photo) => ({
          id: photo.id,
          file: photo.file,
          exif: photo.exif,
          preconvertedExif: photo.preconvertedExif,
          preview: photo.previewUrl,
          orderIndex: photo.orderIndex,
        }));

        if (replace && nextPhotos.length === 0 && photos.length > 0) {
          return;
        }

        setPhotos(nextPhotos);
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [
      photos,
      maxPhotos,
      convertFiles,
      setIsProcessingFiles,
      setPhotos,
      t,
      topicOrderIndexes,
    ],
  );

  return {
    handleFileSelect,
  };
}
