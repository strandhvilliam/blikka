"use client";

import { AlertTriangle, Loader2, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
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
  isSubmitting: boolean;
  submitDisabled: boolean;
  onBackAction: () => void;
  onSubmitAction: () => void;
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
  isSubmitting,
  submitDisabled,
  onBackAction,
  onSubmitAction,
}: UploadStepProps) {
  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <ParticipantSummaryCard {...participantSummary} />

          {requiresOverwriteWarning ? (
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This participant already has an initialized upload. Starting
                  again will replace the current in-progress submission set.
                </p>
              </div>
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-[#ddd8ca] bg-white/92 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7a7566]">
              Topic mapping
            </p>
            <div className="mt-4 space-y-2">
              {selectedTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between rounded-2xl border border-[#ece7da] bg-[#fcfbf7] px-4 py-3"
                >
                  <span className="text-sm font-medium text-[#26231e]">
                    #{topic.orderIndex + 1} {topic.name}
                  </span>
                  <span className="text-xs text-[#7a7566]">
                    orderIndex {topic.orderIndex}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5 rounded-[2rem] border border-[#ddd8ca] bg-white/92 p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7a7566]">
              Step 3
            </p>
            <h2 className="mt-3 font-rocgrotesk text-4xl leading-none text-[#1d1b17]">
              Select photos
            </h2>
            <p className="mt-3 text-sm text-[#666152]">
              Use the SD card files for this participant. The upload will only
              start once the exact required number of images has been selected.
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
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-[#ddd8ca] bg-[#fbfaf6]/95 px-5 py-4 shadow-[0_20px_60px_rgba(16,14,10,0.08)] backdrop-blur-sm">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={onBackAction}
          disabled={isBusy}
        >
          Back
        </Button>
        <PrimaryButton
          type="button"
          className="min-w-[220px] rounded-full px-6"
          onClick={onSubmitAction}
          disabled={submitDisabled}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UploadIcon className="mr-2 h-4 w-4" />
          )}
          Start upload
        </PrimaryButton>
      </div>
    </section>
  );
}

