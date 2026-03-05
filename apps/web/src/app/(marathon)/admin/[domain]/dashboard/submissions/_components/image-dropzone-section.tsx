"use client";

import { cn } from "@/lib/utils";
import { ADMIN_COMMON_IMAGE_EXTENSIONS } from "../_lib/types";
import { pluralizePhotos } from "../_hooks/use-participant-upload-form";
import { DropzoneStatusBadge } from "./dropzone-status-badge";

export type DropzoneVariant =
  | "disabled"
  | "ready"
  | "complete"
  | "success"
  | "processing";

export interface ImageDropzoneSectionDropzoneProps {
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
}

export interface ImageDropzoneSectionDropzoneState {
  isDropzoneDisabled: boolean;
  variant: DropzoneVariant;
  isProcessingFiles: boolean;
  expectedPhotoCount: number;
  selectedPhotosCount: number;
  isMaxImagesReached: boolean;
  dropzoneDisabledReason: string | null;
  formErrorsFiles?: string;
}

interface ImageDropzoneSectionProps {
  dropzoneProps: ImageDropzoneSectionDropzoneProps;
  dropzoneState: ImageDropzoneSectionDropzoneState;
}

export function ImageDropzoneSection({
  dropzoneProps,
  dropzoneState,
}: ImageDropzoneSectionProps) {
  const { getRootProps, getInputProps, isDragActive } = dropzoneProps;
  const {
    isDropzoneDisabled,
    variant,
    isProcessingFiles,
    expectedPhotoCount,
    selectedPhotosCount,
    isMaxImagesReached,
    dropzoneDisabledReason,
    formErrorsFiles,
  } = dropzoneState;
  return (
    <section>
      <h3 className="mb-3 font-gothic text-lg text-[#1f1f1f]">
        Image Upload
      </h3>
      <div
        {...getRootProps()}
        className={cn(
          "rounded-lg border border-dashed p-4 transition-colors",
          isDropzoneDisabled
            ? variant === "complete"
              ? "cursor-default border-emerald-300 bg-emerald-50/50"
              : "cursor-not-allowed border-[#deded4] bg-[#f5f5f0] text-[#8a8a81]"
            : isDragActive
              ? "cursor-copy border-[#45453e] bg-[#efefe9]"
              : "cursor-pointer border-[#d7d7cd] bg-[#fafaf6] hover:bg-[#f4f4ed]",
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#292922]">
              Required: {pluralizePhotos(expectedPhotoCount)}
            </p>
            <p className="text-xs text-[#6a6a63]">
              Current selection:{" "}
              <span
                className={cn(
                  isMaxImagesReached && "font-medium text-emerald-600",
                )}
              >
                {pluralizePhotos(selectedPhotosCount)}
              </span>
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-[#d8d8ce] bg-white px-3 py-1.5 text-xs font-medium">
            <DropzoneStatusBadge
              variant={variant}
              isProcessing={isProcessingFiles}
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-[#6a6a63]">
          Accepted types: {ADMIN_COMMON_IMAGE_EXTENSIONS.join(", ")}
        </p>
        {isDropzoneDisabled && variant !== "complete" && dropzoneDisabledReason ? (
          <p className="mt-2 text-xs text-[#7a7a72]">
            {dropzoneDisabledReason}
          </p>
        ) : null}
        {formErrorsFiles ? (
          <p className="mt-2 text-xs text-rose-600">{formErrorsFiles}</p>
        ) : null}
      </div>
    </section>
  );
}
