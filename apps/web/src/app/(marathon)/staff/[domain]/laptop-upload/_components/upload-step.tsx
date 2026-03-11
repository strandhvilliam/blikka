"use client";

import { AlertTriangle } from "lucide-react";

import type { Topic } from "@blikka/db";
import type { ValidationResult } from "@blikka/validation";
import type { ParticipantSelectedPhoto } from "@/lib/participant-upload/types";
import { StaffParticipantCard } from "./staff-participant-card";
import { StaffDropzone } from "./staff-dropzone";
import { StaffPhotoList } from "./staff-photo-grid";

interface UploadStepProps {
  participantSummary: {
    reference: string;
    firstName: string;
    lastName: string;
    email: string;
    competitionClassName: string;
    deviceGroupName: string;
    statusLabel: string;
    statusTone?: "default" | "warning" | "success";
  };
  selectedTopics: Topic[];
  requiresOverwriteWarning: boolean;
  expectedPhotoCount: number;
  isBusy: boolean;
  photos: ParticipantSelectedPhoto[];
  photoValidationMap: Map<string, ValidationResult[]>;
  blockingErrorCount: number;
  warningCount: number;
  onRemovePhoto: (photoId: string) => void;
  dropzone: {
    getRootProps: () => Record<string, unknown>;
    getInputProps: () => Record<string, unknown>;
    isDragActive: boolean;
  };
  dropzoneDisabled: boolean;
  isProcessingFiles: boolean;
  filesError?: string | null;
}

export function UploadStep({
  participantSummary,
  selectedTopics,
  requiresOverwriteWarning,
  expectedPhotoCount,
  isBusy,
  photos,
  photoValidationMap,
  blockingErrorCount,
  warningCount,
  onRemovePhoto,
  dropzone,
  dropzoneDisabled,
  isProcessingFiles,
  filesError,
}: UploadStepProps) {
  const selectedCount = photos.length;
  const isComplete = selectedCount >= expectedPhotoCount && expectedPhotoCount > 0;

  return (
    <div className="space-y-6">
      <StaffParticipantCard {...participantSummary} />

      {requiresOverwriteWarning ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This participant already has an upload in progress. Starting again
            will replace it.
          </p>
        </div>
      ) : null}

      <StaffDropzone
        getRootProps={dropzone.getRootProps}
        getInputProps={dropzone.getInputProps}
        isDragActive={dropzone.isDragActive}
        isDisabled={dropzoneDisabled}
        isProcessing={isProcessingFiles}
        selectedCount={selectedCount}
        expectedCount={expectedPhotoCount}
        errorMessage={filesError}
      />

      <StaffPhotoList
        photos={photos}
        expectedCount={expectedPhotoCount}
        topics={selectedTopics}
        photoValidationMap={photoValidationMap}
        isBusy={isBusy}
        onRemove={onRemovePhoto}
      />

      {(blockingErrorCount > 0 || warningCount > 0) && photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {blockingErrorCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {blockingErrorCount} issue{blockingErrorCount !== 1 ? "s" : ""} to fix
            </span>
          ) : null}
          {warningCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {isComplete && blockingErrorCount === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-center text-sm font-medium text-emerald-700">
          Ready to upload &mdash; review the photos above, then press Start upload
        </div>
      ) : null}

    </div>
  );
}
