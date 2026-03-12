"use client";

import { z } from "zod";

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

export interface UploadRealtimeFileSnapshot<TPhase extends string = string> {
  key: string;
  orderIndex: number;
  phase: TPhase;
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

export function getRealtimeSubmissionCompletion<TPhase extends string>(
  files: readonly UploadRealtimeFileSnapshot<TPhase>[],
  orderIndex: number | null | undefined,
  completedPhase: TPhase,
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
    shouldUpdate: file.phase !== completedPhase,
  };
}

export function getPollingCompletionKeys<TPhase extends string>(
  files: readonly UploadRealtimeFileSnapshot<TPhase>[],
  submissions: readonly UploadStatusSubmissionSnapshot[],
  completedPhase: TPhase,
): string[] {
  const completedKeys = new Set(
    files
      .filter((file) => file.phase === completedPhase)
      .map((file) => file.key),
  );

  return submissions
    .filter(
      (submission) => submission.uploaded && !completedKeys.has(submission.key),
    )
    .map((submission) => submission.key);
}

export function shouldCompleteUploadFlow<TPhase extends string>(
  files: readonly UploadRealtimeFileSnapshot<TPhase>[],
  participantFinalized: boolean,
  completedPhase: TPhase,
): boolean {
  return (
    participantFinalized &&
    files.length > 0 &&
    files.every((file) => file.phase === completedPhase)
  );
}

export function shouldReconcileUploadStatus(
  outcome: UploadRealtimeEventData["outcome"],
): boolean {
  return outcome === "error";
}
