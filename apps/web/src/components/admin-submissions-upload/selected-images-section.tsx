"use client";
/* eslint-disable @next/next/no-img-element */

import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { VALIDATION_OUTCOME } from "@blikka/validation";
import type { ValidationResult } from "@blikka/validation";
import type { ParticipantSelectedPhoto } from "@/lib/participant-upload-types";
import { cn } from "@/lib/utils";
import { createValidationResultKey } from "@/lib/validation";
import {
  formatRuleKey,
  getValidationRowClass,
} from "@/lib/upload-utils";

export interface SelectedImagesSectionPhotoSelection {
  selectedPhotos: ParticipantSelectedPhoto[];
  photoValidationMap: Map<string, ValidationResult[]>;
  generalValidationResults: ValidationResult[];
  blockingValidationErrors: ValidationResult[];
  warningValidationResults: ValidationResult[];
  validationRunError: string | null;
  handleRemovePhoto: (photoId: string) => void;
}

interface SelectedImagesSectionUploadFlow {
  uploadComplete: boolean;
}

interface SelectedImagesSectionProps {
  photoSelection: SelectedImagesSectionPhotoSelection;
  uploadFlow: SelectedImagesSectionUploadFlow;
  expectedPhotoCount: number;
  isBusy: boolean;
}

const EMPTY_STATE = (
  <div className="rounded-lg border border-dashed border-[#d7d7ce] bg-white px-4 py-6 text-center">
    <p className="text-sm text-[#6f6f66]">No images selected yet.</p>
  </div>
);

export function SelectedImagesSection({
  photoSelection,
  uploadFlow,
  expectedPhotoCount,
  isBusy,
}: SelectedImagesSectionProps) {
  const {
    selectedPhotos,
    photoValidationMap,
    generalValidationResults,
    blockingValidationErrors,
    warningValidationResults,
    validationRunError,
    handleRemovePhoto,
  } = photoSelection;
  const { uploadComplete } = uploadFlow;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-gothic text-lg text-[#1f1f1f]">Selected Images</h3>
        <Badge variant="outline" className="border-[#deded4] text-[#66665f]">
          {selectedPhotos.length}/{expectedPhotoCount}
        </Badge>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs">
        <Badge className="border border-rose-200 bg-rose-50 text-rose-700">
          {blockingValidationErrors.length} blocking
        </Badge>
        <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
          {warningValidationResults.length} warnings
        </Badge>
      </div>

      {generalValidationResults.length > 0 ? (
        <Collapsible className="mb-3 rounded-lg border border-[#e2e2d8] bg-white">
          <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-left">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#67675f]">
              General validations ({generalValidationResults.length})
            </span>
            <ChevronDown className="h-4 w-4 text-[#6f6f66] transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3 pb-3">
            {generalValidationResults.map((result, index) => (
              <div
                key={`${createValidationResultKey(result)}-${index}`}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  getValidationRowClass(result),
                )}
              >
                <p className="font-semibold">{formatRuleKey(result.ruleKey)}</p>
                <p className="mt-1">{result.message}</p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {validationRunError ? (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {validationRunError}
        </div>
      ) : null}

      {selectedPhotos.length === 0 ? (
        EMPTY_STATE
      ) : (
        <div className="space-y-2">
          {selectedPhotos.map((photo) => {
            const photoValidationResults = photoValidationMap.get(photo.id) ?? [];
            const photoErrorCount = photoValidationResults.filter(
              (result) =>
                result.outcome === VALIDATION_OUTCOME.FAILED &&
                result.severity === "error",
            ).length;
            const photoWarningCount = photoValidationResults.filter(
              (result) =>
                result.outcome === VALIDATION_OUTCOME.FAILED &&
                result.severity === "warning",
            ).length;

            return (
              <div
                key={photo.id}
                className="upload-list-item rounded-lg border border-[#e3e3d9] bg-white px-3 py-3"
                style={{
                  contentVisibility: "auto",
                  containIntrinsicSize: "0 80px",
                }}
              >
                <div className="flex items-start gap-3">
                  <img
                    src={photo.previewUrl}
                    alt={photo.file.name}
                    className="h-14 w-14 rounded-md border border-[#dfdfd5] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#2b2b24]">
                          {photo.file.name}
                        </p>
                        <p className="mt-1 text-xs text-[#6a6a62]">
                          Topic #{photo.orderIndex + 1} ·{" "}
                          {(photo.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#77776f] hover:text-rose-600"
                        onClick={() => handleRemovePhoto(photo.id)}
                        disabled={isBusy || uploadComplete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {photoErrorCount > 0 ? (
                        <Badge className="border border-rose-200 bg-rose-50 text-rose-700">
                          {photoErrorCount} errors
                        </Badge>
                      ) : null}
                      {photoWarningCount > 0 ? (
                        <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
                          {photoWarningCount} warnings
                        </Badge>
                      ) : null}
                      {photoErrorCount === 0 && photoWarningCount === 0 ? (
                        <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                          No validation issues
                        </Badge>
                      ) : null}
                    </div>

                    <Collapsible className="mt-2 rounded-md border border-[#ecece2]">
                      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-[#5c5c55]">
                        Validation details
                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 px-3 pb-3">
                        {photoValidationResults.length === 0 ? (
                          <p className="text-xs text-[#707069]">
                            No file-level validation findings.
                          </p>
                        ) : (
                          photoValidationResults.map((result, index) => (
                            <div
                              key={`${createValidationResultKey(result)}-${index}`}
                              className={cn(
                                "rounded-md border px-3 py-2 text-xs",
                                getValidationRowClass(result),
                              )}
                            >
                              <p className="font-semibold">
                                {formatRuleKey(result.ruleKey)}
                              </p>
                              <p className="mt-1">{result.message}</p>
                            </div>
                          ))
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
