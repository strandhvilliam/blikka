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
import { StaffParticipantCard } from "./staff-participant-card";

interface UploadProgressPanelProps {
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
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-5">
      <StaffParticipantCard {...participantSummary} />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Upload progress
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-rocgrotesk text-3xl leading-none text-foreground">
                {completed}/{total || files.length || 0}
              </span>
              <Badge
                variant="outline"
                className="border-border bg-muted text-muted-foreground"
              >
                {isWorking ? "In progress" : "Paused"}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRetryFailedUploads ? (
              <PrimaryButton
                type="button"
                className="rounded-full text-sm"
                onClick={onRetryAction}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Retry failed
              </PrimaryButton>
            ) : null}
            {canSaveLocally ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full text-sm"
                onClick={onSaveLocallyAction}
              >
                <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                Save locally
              </Button>
            ) : null}
            {!isWorking && !canRetryFailedUploads ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full text-sm"
                onClick={onBackAction}
              >
                Back to photos
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isWorking ? "bg-foreground" : "bg-emerald-500",
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {uploadErrorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {uploadErrorMessage}
          </div>
        ) : null}
      </div>

      {files.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Files
          </p>
          {files.map((file) => (
            <div
              key={file.key}
              className="rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Photo #{file.orderIndex + 1}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-xs",
                    getUploadPhaseClassName(file.phase),
                  )}
                >
                  {file.phase === "uploading" ? (
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
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted px-5 py-10 text-center text-sm text-muted-foreground">
          Preparing upload&hellip;
        </div>
      )}
    </div>
  );
}
