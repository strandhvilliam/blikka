"use client";

import { useEffect } from "react";
import type { RuleConfig } from "@blikka/db";
import { runParticipantPhotoValidation } from "@/lib/participant-photo-validation";
import type { UploadMarathonMode } from "@/lib/types";
import { useStaffUploadStore } from "@/lib/staff/staff-upload-store";
import type { StaffUploadStep } from "@/hooks/staff/use-staff-upload-step";

interface UsePhotoValidationOptions {
  step: StaffUploadStep;
  ruleConfigs: RuleConfig[];
  marathonStartDate?: string | Date | null;
  marathonEndDate?: string | Date | null;
  marathonMode: UploadMarathonMode;
}

/**
 * Runs photo validation whenever photos change on the upload step.
 * Results are written directly to the store so they're available to child components.
 */
export function useStaffPhotoValidation({
  step,
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
  marathonMode,
}: UsePhotoValidationOptions) {
  const selectedPhotos = useStaffUploadStore((s) => s.selectedPhotos);
  const patchPhotos = useStaffUploadStore((s) => s.patchPhotos);

  useEffect(() => {
    let cancelled = false;

    if (step !== "upload") return;

    if (selectedPhotos.length === 0) {
      patchPhotos({ validationResults: [], validationRunError: null });
      return;
    }

    const runValidation = async () => {
      try {
        const results = await runParticipantPhotoValidation({
          photos: selectedPhotos,
          ruleConfigs,
          marathonStartDate,
          marathonEndDate,
          marathonMode,
        });

        if (!cancelled) {
          patchPhotos({ validationResults: results, validationRunError: null });
        }
      } catch (error) {
        if (!cancelled) {
          patchPhotos({
            validationResults: [],
            validationRunError:
              error instanceof Error
                ? error.message
                : "Failed to validate selected images",
          });
        }
      }
    };

    void runValidation();

    return () => {
      cancelled = true;
    };
  }, [
    marathonEndDate,
    marathonMode,
    marathonStartDate,
    ruleConfigs,
    selectedPhotos,
    patchPhotos,
    step,
  ]);
}
