"use client";

import { useEffect } from "react";
import type { RuleConfig } from "@blikka/db";
import { runParticipantPhotoValidation } from "@/lib/participant-photo-validation";
import type { UploadMarathonMode } from "@/lib/types";
import { usePhotoStore } from "../_lib/photo-store";

interface UseLivePhotoValidationOptions {
  ruleConfigs: RuleConfig[];
  validationStartDate?: string | Date | null;
  validationEndDate?: string | Date | null;
  marathonMode: UploadMarathonMode;
}

export function useLivePhotoValidation({
  ruleConfigs,
  validationStartDate,
  validationEndDate,
  marathonMode,
}: UseLivePhotoValidationOptions) {
  const photos = usePhotoStore((state) => state.photos);
  const setValidationResults = usePhotoStore(
    (state) => state.setValidationResults,
  );

  useEffect(() => {
    let cancelled = false;

    if (photos.length === 0) {
      setValidationResults([]);
      return;
    }

    const runValidation = async () => {
      try {
        const results = await runParticipantPhotoValidation({
          photos,
          ruleConfigs,
          marathonStartDate: validationStartDate,
          marathonEndDate: validationEndDate,
          marathonMode,
        });

        if (!cancelled) {
          setValidationResults(results);
        }
      } catch (error) {
        console.error("Live photo validation failed:", error);

        if (!cancelled) {
          setValidationResults([]);
        }
      }
    };

    void runValidation();

    return () => {
      cancelled = true;
    };
  }, [
    validationEndDate,
    validationStartDate,
    marathonMode,
    photos,
    ruleConfigs,
    setValidationResults,
  ]);
}
