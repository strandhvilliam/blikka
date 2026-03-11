"use client";

import { AlertTriangle } from "lucide-react";

import { ImageDropzoneSection } from "@/components/participant-upload/image-dropzone-section";
import { SelectedImagesSection } from "@/components/participant-upload/selected-images-section";
import { ParticipantSummaryCard } from "./participant-summary-card";
import type {
  ImageDropzoneSectionDropzoneProps,
  ImageDropzoneSectionDropzoneState,
} from "@/components/participant-upload/image-dropzone-section";
import type { SelectedImagesSectionPhotoSelection } from "@/components/participant-upload/selected-images-section";
import type { Topic } from "@blikka/db";

interface UploadStepProps {
  participantSummary: {
    reference: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    competitionClassName: string;
    deviceGroupName: string;
    statusLabel: string;
    statusTone?: "default" | "warning" | "success";
  };
  selectedTopics: Topic[];
  requiresOverwriteWarning: boolean;
  photoSelection: SelectedImagesSectionPhotoSelection;
  expectedPhotoCount: number;
  dropzoneProps: ImageDropzoneSectionDropzoneProps;
  dropzoneState: ImageDropzoneSectionDropzoneState;
  isBusy: boolean;
}

export function UploadStep({
  participantSummary,
  selectedTopics,
  requiresOverwriteWarning,
  photoSelection,
  expectedPhotoCount,
  dropzoneProps,
  dropzoneState,
  isBusy,
}: UploadStepProps) {
  return (
    <div className="space-y-5">
      <ParticipantSummaryCard {...participantSummary} />

      {requiresOverwriteWarning ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This participant already has an initialized upload. Starting again
            will replace the current in-progress submission set.
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Photo selection
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Drop or select files from the SD card. Photos are matched to topics by
          the order they were taken.
        </p>
      </div>

      <ImageDropzoneSection
        dropzoneProps={dropzoneProps}
        dropzoneState={dropzoneState}
      />

      <SelectedImagesSection
        photoSelection={photoSelection}
        uploadFlow={{ uploadComplete: false }}
        expectedPhotoCount={expectedPhotoCount}
        isBusy={isBusy}
      />

      {selectedTopics.length > 0 ? (
        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Topic order ({selectedTopics.length}{" "}
            {selectedTopics.length === 1 ? "topic" : "topics"})
            <span className="text-muted-foreground/50 transition-transform group-open:rotate-180">
              &#9662;
            </span>
          </summary>
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {selectedTopics.map((topic) => (
              <div
                key={topic.id}
                className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground"
              >
                #{topic.orderIndex + 1} {topic.name}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
