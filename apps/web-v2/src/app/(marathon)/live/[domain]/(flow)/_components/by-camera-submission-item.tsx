"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  Info,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { SelectedPhoto } from "../_lib/types";
import { VALIDATION_OUTCOME, type ValidationResult } from "@blikka/validation";
import { ValidationStatusBadge } from "./validation-status-badge";

interface ByCameraSubmissionItemProps {
  photo: SelectedPhoto;
  validationResults?: ValidationResult[];
  onRemove?: () => void;
}

export function ByCameraSubmissionItem({
  photo,
  validationResults,
  onRemove,
}: ByCameraSubmissionItemProps) {
  const t = useTranslations("FlowPage.uploadStep");
  const [expanded, setExpanded] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);

  const exifData = photo?.exif || {};
  const relevantExifData = getRelevantExifData(exifData);
  const hasExifData = Object.keys(relevantExifData).length > 0;
  const takenAt = getTimeTaken(photo?.exif);

  // Sort validation results by severity (errors first, then warnings)
  const sortedValidationResults = useMemo(() => {
    return validationResults?.sort((a, b) => {
      if (a.outcome !== b.outcome) {
        if (a.outcome === VALIDATION_OUTCOME.FAILED) return -1;
        if (b.outcome === VALIDATION_OUTCOME.FAILED) return 1;
        if (a.outcome === VALIDATION_OUTCOME.SKIPPED) return -1;
        if (b.outcome === VALIDATION_OUTCOME.SKIPPED) return 1;
      }

      if (a.severity !== b.severity) {
        if (a.severity === "error") return -1;
        if (b.severity === "error") return 1;
      }

      return 0;
    });
  }, [validationResults]);

  // Get the highest priority validation result to display
  const displayValidation = useMemo(() => {
    const highestPriorityResult = sortedValidationResults?.[0];

    // Check if EXIF data is missing (warning for photos without metadata)
    if (photo?.exif && Object.keys(photo.exif).length === 0) {
      return {
        message: t("noExifData"),
        outcome: VALIDATION_OUTCOME.FAILED as typeof VALIDATION_OUTCOME.FAILED,
        severity: "warning" as const,
      };
    }

    return {
      message: highestPriorityResult?.message,
      outcome: highestPriorityResult?.outcome,
      severity: highestPriorityResult?.severity,
      ruleKey: highestPriorityResult?.ruleKey,
    };
  }, [sortedValidationResults, photo?.exif, t]);

  return (
    <div className="flex flex-col border rounded-lg bg-background overflow-hidden">
      <div className="flex flex-row gap-4 p-4">
        <div className="flex-1 space-y-2">
          <div className="space-y-0">
            <p className="font-medium">{t("yourPhoto")}</p>
          </div>

          {/* Validation status - show passed badge when no failures */}
          {validationResults && validationResults.length === 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <ValidationStatusBadge
                  outcome={VALIDATION_OUTCOME.PASSED}
                  severity="error"
                />
              </div>
            </div>
          )}

          {/* Validation status - show failures/warnings */}
          {validationResults && validationResults.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <ValidationStatusBadge
                  outcome={displayValidation.outcome}
                  severity={displayValidation.severity}
                />
              </div>

              {displayValidation.message &&
                displayValidation.outcome !== VALIDATION_OUTCOME.PASSED && (
                  <p
                    className={`text-xs ${
                      displayValidation.severity === "error"
                        ? "text-destructive"
                        : displayValidation.outcome === VALIDATION_OUTCOME.FAILED
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {displayValidation.message}
                  </p>
                )}
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">
              {takenAt && `${t("taken")} ${format(takenAt, "cccc, HH:mm")}`}
              {takenAt && photo.file.name && " | "}
              {photo.file.name && `${t("file")} ${photo.file.name}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasExifData && (
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 px-2 h-7 text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                <Info className="h-3.5 w-3.5" />
                <span>{t("photoDetails")}</span>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
        <div className="relative w-[100px] h-[100px] shrink-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full rounded-lg overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.preview}
              alt={t("uploadPreviewAlt", { index: 1 })}
              className="object-cover w-full h-full cursor-pointer"
              onClick={() => setShowImageDialog(true)}
            />
          </motion.div>
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/75 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {expanded && hasExifData && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-3 border-t"
        >
          <table className="w-full text-xs mt-2">
            <tbody>
              {Object.entries(relevantExifData).map(([key, value]) => (
                <tr
                  key={key}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                >
                  <td className="py-1.5 font-medium text-muted-foreground">
                    {key}
                  </td>
                  <td className="py-1.5 text-right">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {showImageDialog && (
        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>
                {t("photoPreview")}
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 pt-0">
              <div className="w-full max-h-[70vh] overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt={t("fullPreviewAlt", { index: 1 })}
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function getTimeTaken(exif?: Record<string, unknown>): Date | null {
  if (!exif?.DateTimeOriginal) return null;

  try {
    const dateString = String(exif.DateTimeOriginal);
    const date = new Date(dateString);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  } catch {
    // Skip if date parsing fails
  }

  return null;
}

function getRelevantExifData(exif: Record<string, unknown>): Record<string, string> {
  const relevantData: Record<string, string> = {};

  // Guard against undefined or null exif data
  if (!exif) return relevantData;

  // Camera info
  if (exif.Make && typeof exif.Make === "string")
    relevantData["Camera Make"] = exif.Make;
  if (exif.Model && typeof exif.Model === "string")
    relevantData["Camera Model"] = exif.Model;

  // Exposure settings
  if (exif.ExposureTime && typeof exif.ExposureTime === "number") {
    const exposureValue = exif.ExposureTime;
    relevantData["Exposure"] =
      exposureValue < 1
        ? `1/${Math.round(1 / exposureValue)}s`
        : `${exposureValue}s`;
  }

  if (exif.FNumber && typeof exif.FNumber === "number") {
    relevantData["Aperture"] = `f/${exif.FNumber}`;
  }

  if (
    exif.ISO &&
    (typeof exif.ISO === "number" || typeof exif.ISO === "string")
  ) {
    relevantData["ISO"] = `ISO ${exif.ISO}`;
  }

  if (exif.FocalLength && typeof exif.FocalLength === "number") {
    relevantData["Focal Length"] = `${exif.FocalLength}mm`;
  }

  // Date & time
  if (exif.DateTimeOriginal) {
    try {
      const dateString = String(exif.DateTimeOriginal);
      const date = new Date(dateString);
      if (!Number.isNaN(date.getTime())) {
        relevantData["Date Taken"] = date.toLocaleDateString();
        relevantData["Time Taken"] = date.toLocaleTimeString();
      }
    } catch {
      // Skip if date parsing fails
    }
  }

  // Lens info
  if (exif.LensModel && typeof exif.LensModel === "string") {
    relevantData["Lens"] = exif.LensModel;
  }

  // GPS
  if (
    exif.latitude &&
    exif.longitude &&
    typeof exif.latitude === "number" &&
    typeof exif.longitude === "number"
  ) {
    relevantData["GPS"] =
      `${exif.latitude.toFixed(6)}, ${exif.longitude.toFixed(6)}`;
  }

  return relevantData;
}
