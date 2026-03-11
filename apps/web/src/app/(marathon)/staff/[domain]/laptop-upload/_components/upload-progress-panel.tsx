"use client";

import { DownloadIcon, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import type { ParticipantUploadFileState } from "@/lib/participant-upload/types";
import {
  getUploadPhaseClassName,
  getUploadPhaseLabel,
} from "@/lib/participant-upload/upload-utils";
import { cn } from "@/lib/utils";
import { ParticipantSummaryCard } from "./participant-summary-card";

interface UploadProgressPanelProps {
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
  files: ParticipantUploadFileState[];
  completed: number;
  total: number;
  isWorking: boolean;
  uploadErrorMessage?: string | null;
  canRetryFailedUploads: boolean;
  isRetrying: boolean;
  canSaveLocally: boolean;
  onRetryAction: () => void;
  onSaveLocallyAction: () => void;
  onBackAction: () => void;
}

export function UploadProgressPanel({
  participantSummary,
  files,
  completed,
  total,
  isWorking,
  uploadErrorMessage,
  canRetryFailedUploads,
  isRetrying,
  canSaveLocally,
  onRetryAction,
  onSaveLocallyAction,
  onBackAction,
}: UploadProgressPanelProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <ParticipantSummaryCard {...participantSummary} />

        <div className="rounded-[1.75rem] border border-[#ddd8ca] bg-white/92 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7a7566]">
            Upload status
          </p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-rocgrotesk text-4xl leading-none text-[#1d1b17]">
                {completed}/{total || files.length || 0}
              </h2>
              <p className="mt-2 text-sm text-[#666152]">
                {isWorking
                  ? "Uploading and processing files."
                  : "Upload is waiting for your next action."}
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-[#d9d4c7] bg-[#f8f4ea] text-[#605a4f]"
            >
              {isWorking ? "In progress" : "Paused"}
            </Badge>
          </div>

          {uploadErrorMessage ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {uploadErrorMessage}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {canRetryFailedUploads ? (
              <PrimaryButton
                type="button"
                className="rounded-full"
                onClick={onRetryAction}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Retry failed uploads
              </PrimaryButton>
            ) : null}
            {canSaveLocally ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={onSaveLocallyAction}
              >
                <DownloadIcon className="mr-2 h-4 w-4" />
                Save files locally
              </Button>
            ) : null}
            {!isWorking && !canRetryFailedUploads ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={onBackAction}
              >
                Back to selection
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-[#ddd8ca] bg-white/92 p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7a7566]">
            File activity
          </p>
          <h3 className="mt-3 font-gothic text-2xl text-[#1d1b17]">
            Upload queue
          </h3>
        </div>

        {files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d7d1c3] bg-[#faf8f1] px-5 py-10 text-center text-sm text-[#6e685a]">
            Waiting for upload to initialize.
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.key}
                className="rounded-2xl border border-[#e4dfd1] bg-[#fcfbf7] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#26231e]">
                      {file.file.name}
                    </p>
                    <p className="mt-1 text-xs text-[#726d5e]">
                      Topic #{file.orderIndex + 1}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getUploadPhaseClassName(file.phase))}
                  >
                    {file.phase === "uploading" ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    {getUploadPhaseLabel(file.phase)}
                  </Badge>
                </div>
                {file.error ? (
                  <p className="mt-3 text-xs text-rose-600">
                    {file.error.message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

