"use client";

import type { Topic } from "@blikka/db";
import { ByCameraUploadProgress } from "./by-camera-upload-progress";
import { MarathonUploadProgress } from "./marathon-upload-progress";
import type { FinalizationState, UploadFileState } from "@/lib/flow/types";

interface UploadProgressProps {
  files: UploadFileState[];
  topics: Topic[];
  expectedCount: number;
  onRetry?: () => void;
  finalizationState: FinalizationState;
  participantReference?: string;
  mode?: "marathon" | "by-camera";
}

export function UploadProgress({
  files,
  topics,
  expectedCount,
  onRetry,
  finalizationState,
  participantReference,
  mode = "marathon",
}: UploadProgressProps) {
  if (mode === "by-camera") {
    return (
      <ByCameraUploadProgress
        files={files}
        expectedCount={expectedCount}
        onRetry={onRetry}
        finalizationState={finalizationState}
        participantReference={participantReference}
      />
    );
  }

  return (
    <MarathonUploadProgress
      files={files}
      topics={topics}
      expectedCount={expectedCount}
      onRetry={onRetry}
      participantReference={participantReference}
    />
  );
}
