"use client";

import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ADMIN_UPLOAD_PHASE } from "../../_lib/admin-upload/types";
import type { AdminUploadFileState } from "../../_lib/admin-upload/types";
import {
  getUploadPhaseLabel,
  getUploadPhaseClassName,
} from "./upload-utils";
import { cn } from "@/lib/utils";

interface UploadStatusSectionProps {
  uploadFiles: AdminUploadFileState[];
  uploadProgress: { completed: number; total: number };
  uploadErrorMessage: string | null;
  canRetryFailedUploads: boolean;
  uploadComplete: boolean;
  submittedReference: string;
  isUploadingFiles: boolean;
  isBusy: boolean;
  onRetryFailed: () => void;
}

export function UploadStatusSection({
  uploadFiles,
  uploadProgress,
  uploadErrorMessage,
  canRetryFailedUploads,
  uploadComplete,
  submittedReference,
  isUploadingFiles,
  isBusy,
  onRetryFailed,
}: UploadStatusSectionProps) {
  return (
    <>
      <Separator />
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-gothic text-lg text-[#1f1f1f]">
            Upload Status
          </h3>
          <span className="text-xs text-[#66665f]">
            {uploadProgress.completed}/{uploadProgress.total}
          </span>
        </div>

        {uploadFiles.length === 0 ? (
          <p className="text-sm text-[#6d6d64]">
            Upload has not started yet.
          </p>
        ) : (
          <div className="space-y-2">
            {uploadFiles.map((file) => (
              <div
                key={file.key}
                className="upload-list-item rounded-md border border-[#e1e1d8] bg-white px-3 py-3"
                style={{
                  contentVisibility: "auto",
                  containIntrinsicSize: "0 80px",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-[#2b2b24]">
                    {file.file.name}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getUploadPhaseClassName(file.phase))}
                  >
                    {file.phase === ADMIN_UPLOAD_PHASE.UPLOADING ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    {getUploadPhaseLabel(file.phase)}
                  </Badge>
                </div>
                {file.error ? (
                  <p className="mt-2 text-xs text-rose-600">
                    {file.error.message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {uploadErrorMessage ? (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {uploadErrorMessage}
          </div>
        ) : null}

        {canRetryFailedUploads && !uploadComplete ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={onRetryFailed}
            disabled={isBusy}
          >
            {isUploadingFiles ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Retry Failed Uploads
          </Button>
        ) : null}

        {uploadComplete ? (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-semibold">Upload completed</p>
                <p className="text-xs">
                  Participant #{submittedReference} is ready for review.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
