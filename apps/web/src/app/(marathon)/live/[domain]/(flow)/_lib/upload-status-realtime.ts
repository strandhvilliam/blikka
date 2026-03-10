"use client";

import { z } from "zod";
import { UPLOAD_PHASE, type UploadPhase } from "./types";

const uploadRealtimeEventDataSchema = z
  .object({
    reference: z.string().nullish(),
    orderIndex: z.number().nullish(),
    outcome: z.enum(["success", "error"]).optional(),
  })
  .loose();

export type UploadRealtimeEventData = z.infer<
  typeof uploadRealtimeEventDataSchema
>;

export interface UploadRealtimeFileSnapshot {
  key: string;
  orderIndex: number;
  phase: UploadPhase;
}

export interface UploadStatusSubmissionSnapshot {
  key: string;
  uploaded: boolean;
}

export function parseUploadRealtimeEventData(
  raw: unknown,
): UploadRealtimeEventData | null {
  const parsedData =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;

  const parsed = uploadRealtimeEventDataSchema.safeParse(parsedData);
  return parsed.success ? parsed.data : null;
}

export function getRealtimeSubmissionCompletion(
  files: readonly UploadRealtimeFileSnapshot[],
  orderIndex: number | null | undefined,
): { key: string; shouldUpdate: boolean } | null {
  if (orderIndex === null || orderIndex === undefined) {
    return null;
  }

  const file = files.find((candidate) => candidate.orderIndex === orderIndex);
  if (!file) {
    return null;
  }

  return {
    key: file.key,
    shouldUpdate: file.phase !== UPLOAD_PHASE.COMPLETED,
  };
}

export function getPollingCompletionKeys(
  files: readonly UploadRealtimeFileSnapshot[],
  submissions: readonly UploadStatusSubmissionSnapshot[],
): string[] {
  const completedKeys = new Set(
    files
      .filter((file) => file.phase === UPLOAD_PHASE.COMPLETED)
      .map((file) => file.key),
  );

  return submissions
    .filter(
      (submission) => submission.uploaded && !completedKeys.has(submission.key),
    )
    .map((submission) => submission.key);
}

export function shouldCompleteUploadFlow(
  files: readonly UploadRealtimeFileSnapshot[],
  participantFinalized: boolean,
): boolean {
  return (
    participantFinalized &&
    files.length > 0 &&
    files.every((file) => file.phase === UPLOAD_PHASE.COMPLETED)
  );
}

export function shouldReconcileUploadStatus(
  outcome: UploadRealtimeEventData["outcome"],
): boolean {
  return outcome === "error";
}
