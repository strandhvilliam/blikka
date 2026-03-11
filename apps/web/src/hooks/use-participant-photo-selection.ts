"use client";

import { useEffect, useRef, useState } from "react";
import type { ValidationResult } from "@blikka/validation";
import type { RuleConfig } from "@blikka/db";
import type { ParticipantSelectedPhoto } from "@/lib/participant-upload/types";
import { toast } from "sonner";
import {
  buildPhotoValidationMap,
  splitValidationResultsBySeverity,
} from "@/lib/validation";
import {
  processSelectedFiles,
  reassignPhotoOrderIndexes,
  revokePhotoPreviewUrls,
} from "@/lib/participant-upload/file-processing";
import { runParticipantPhotoValidation } from "@/lib/participant-upload/validation";

interface UseParticipantPhotoSelectionInput {
  open: boolean;
  topicOrderIndexes: number[];
  expectedPhotoCount: number;
  ruleConfigs: RuleConfig[];
  marathonStartDate?: string | null;
  marathonEndDate?: string | null;
  isUploadBusy: boolean;
  uploadComplete: boolean;
  canSelectFiles: boolean;
  onClearFormFilesError?: () => void;
  onResetUploadState?: () => void;
}

export function useParticipantPhotoSelection({
  open,
  topicOrderIndexes,
  expectedPhotoCount,
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
  isUploadBusy,
  uploadComplete,
  canSelectFiles,
  onClearFormFilesError,
  onResetUploadState,
}: UseParticipantPhotoSelectionInput) {
  const photosRef = useRef<ParticipantSelectedPhoto[]>([]);

  const [selectedPhotos, setSelectedPhotos] = useState<ParticipantSelectedPhoto[]>(
    [],
  );
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [validationResults, setValidationResults] = useState<
    ValidationResult[]
  >([]);
  const [validationRunError, setValidationRunError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    photosRef.current = selectedPhotos;
  }, [selectedPhotos]);

  useEffect(() => {
    return () => {
      revokePhotoPreviewUrls(photosRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!open) return;

    if (selectedPhotos.length === 0) {
      setValidationResults([]);
      setValidationRunError(null);
      return;
    }

    const runValidation = async () => {
      try {
        const results = await runParticipantPhotoValidation({
          photos: selectedPhotos,
          ruleConfigs,
          marathonStartDate,
          marathonEndDate,
        });

        if (cancelled) {
          return;
        }

        setValidationResults(results);
        setValidationRunError(null);
      } catch (error) {
        if (cancelled) return;

        const message =
          error instanceof Error
            ? error.message
            : "Failed to validate selected images";

        setValidationRunError(message);
        setValidationResults([]);
      }
    };

    void runValidation();

    return () => {
      cancelled = true;
    };
  }, [open, selectedPhotos, ruleConfigs, marathonStartDate, marathonEndDate]);

  const generalValidationResults = validationResults.filter(
    (result) =>
      result.isGeneral || (result.orderIndex === undefined && !result.fileName),
  );

  const photoValidationMap = buildPhotoValidationMap(
    selectedPhotos,
    validationResults,
  );

  const {
    blocking: blockingValidationErrors,
    warnings: warningValidationResults,
  } = splitValidationResultsBySeverity(validationResults);

  async function handleFileSelect(fileList: FileList | File[] | null) {
    if (isUploadBusy || uploadComplete || !canSelectFiles) return;

    setIsProcessingFiles(true);
    onResetUploadState?.();

    try {
      const result = await processSelectedFiles({
        fileList,
        existingPhotos: selectedPhotos,
        maxPhotos: expectedPhotoCount,
        topicOrderIndexes,
      });

      if (result.errors.length > 0) {
        result.errors.forEach((message) => toast.error(message));
      }
      if (result.warnings.length > 0) {
        result.warnings.forEach((message) => toast.message(message));
      }
      if (result.photos !== selectedPhotos) {
        setSelectedPhotos(result.photos);
        onClearFormFilesError?.();
      }
    } finally {
      setIsProcessingFiles(false);
    }
  }

  function handleRemovePhoto(photoId: string) {
    if (isUploadBusy || uploadComplete) return;
    onResetUploadState?.();
    setSelectedPhotos((current) => {
      const target = current.find((photo) => photo.id === photoId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const remaining = current.filter((photo) => photo.id !== photoId);
      return reassignPhotoOrderIndexes(remaining, topicOrderIndexes);
    });
  }

  function resetPhotoSelection() {
    setSelectedPhotos((current) => {
      revokePhotoPreviewUrls(current);
      return [];
    });
    setValidationResults([]);
    setValidationRunError(null);
    setIsProcessingFiles(false);
  }

  return {
    selectedPhotos,
    setSelectedPhotos,
    validationResults,
    validationRunError,
    isProcessingFiles,
    generalValidationResults,
    photoValidationMap,
    blockingValidationErrors,
    warningValidationResults,
    handleFileSelect,
    handleRemovePhoto,
    resetPhotoSelection,
  };
}

