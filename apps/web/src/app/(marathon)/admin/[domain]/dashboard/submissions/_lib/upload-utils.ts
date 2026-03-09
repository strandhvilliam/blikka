import { VALIDATION_OUTCOME, type ValidationResult } from "@blikka/validation";
import type { AdminUploadFileState } from "./types";
import { ADMIN_UPLOAD_PHASE } from "./types";

export function formatRuleKey(ruleKey: string) {
  return ruleKey
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function getUploadPhaseLabel(phase: AdminUploadFileState["phase"]) {
  if (phase === ADMIN_UPLOAD_PHASE.PRESIGNED) return "Ready";
  if (phase === ADMIN_UPLOAD_PHASE.UPLOADING) return "Uploading";
  if (phase === ADMIN_UPLOAD_PHASE.PROCESSING) return "Processing";
  if (phase === ADMIN_UPLOAD_PHASE.COMPLETED) return "Completed";
  if (phase === ADMIN_UPLOAD_PHASE.ERROR) return "Failed";
  return "Unknown";
}

export function getUploadPhaseClassName(phase: AdminUploadFileState["phase"]) {
  if (phase === ADMIN_UPLOAD_PHASE.COMPLETED) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (phase === ADMIN_UPLOAD_PHASE.ERROR) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (
    phase === ADMIN_UPLOAD_PHASE.UPLOADING ||
    phase === ADMIN_UPLOAD_PHASE.PROCESSING
  ) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function getValidationRowClass(result: ValidationResult) {
  if (result.outcome !== VALIDATION_OUTCOME.FAILED) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (result.severity === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

type Topic = { orderIndex: number };

export function getDropzoneDisabledReason(params: {
  deviceGroupId: string;
  marathonMode: string;
  competitionClassId: string;
  activeByCameraTopic: Topic | null;
}): string | null {
  const {
    deviceGroupId,
    marathonMode,
    competitionClassId,
    activeByCameraTopic,
  } = params;

  if (!deviceGroupId) {
    return "Select a device group to enable image selection.";
  }
  if (marathonMode === "marathon" && !competitionClassId) {
    return "Select a competition class to enable image selection.";
  }
  if (marathonMode === "by-camera" && !activeByCameraTopic) {
    return "No active topic is available for by-camera upload.";
  }
  return null;
}

export function getDropzoneVariant(params: {
  canSelectFiles: boolean;
  isMaxImagesReached: boolean;
  uploadComplete: boolean;
  isBusy: boolean;
}): "disabled" | "complete" | "success" | "processing" | "ready" {
  const { canSelectFiles, isMaxImagesReached, uploadComplete, isBusy } = params;

  if (!canSelectFiles) return "disabled";
  if (isMaxImagesReached) return "complete";
  if (uploadComplete) return "success";
  if (isBusy) return "processing";
  return "ready";
}
