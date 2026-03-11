"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useDropzone, type Accept } from "react-dropzone";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DROPZONE_ACCEPT: Accept = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

interface StaffDropzoneProps {
  disabled: boolean;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  isProcessing: boolean;
  selectedCount: number;
  expectedCount: number;
  errorMessage?: string | null;
}

export function StaffDropzone({
  disabled,
  onFilesSelected,
  isProcessing,
  selectedCount,
  expectedCount,
  errorMessage,
}: StaffDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: DROPZONE_ACCEPT,
    disabled,
    multiple: true,
    onDropAccepted: (files) => {
      void onFilesSelected(files);
    },
    onDropRejected: () => {
      toast.error("Some files were rejected. Please use supported image formats.");
    },
  });

  const isComplete = selectedCount >= expectedCount && expectedCount > 0;
  const remaining = expectedCount - selectedCount;

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200",
          disabled && !isComplete
            ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
            : isComplete
              ? "cursor-default border-emerald-300 bg-emerald-50/60"
              : isDragActive
                ? "cursor-copy border-primary bg-primary/5 shadow-inner"
                : "cursor-pointer border-border bg-card hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Processing files...
            </p>
          </>
        ) : isComplete ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <ImagePlus className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="mt-3 text-sm font-semibold text-emerald-700">
              All {expectedCount} photos selected
            </p>
          </>
        ) : isDragActive ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ImagePlus className="h-6 w-6 text-primary" />
            </div>
            <p className="mt-3 text-base font-semibold text-primary">
              Drop photos here
            </p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-base font-medium text-foreground">
              {selectedCount === 0
                ? "Drop photos here or click to browse"
                : `Add ${remaining} more photo${remaining === 1 ? "" : "s"}`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {expectedCount} photos needed &middot; JPG, PNG, HEIC, WebP
            </p>
          </>
        )}
      </div>

      {errorMessage ? (
        <p className="text-sm font-medium text-rose-600">{errorMessage}</p>
      ) : null}
    </div>
  );
}
