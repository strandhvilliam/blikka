import { describe, expect, it } from "vitest";
import { PARTICIPANT_UPLOAD_PHASE } from "./participant-upload-types";
import {
  getPollingCompletionKeys,
  getRealtimeSubmissionCompletion,
  parseUploadRealtimeEventData,
  shouldCompleteUploadFlow,
  shouldReconcileUploadStatus,
  type UploadRealtimeFileSnapshot,
} from "./upload-status-realtime";

const COMPLETED_PHASE = PARTICIPANT_UPLOAD_PHASE.COMPLETED;

const files: UploadRealtimeFileSnapshot[] = [
  {
    key: "submission-0",
    orderIndex: 0,
    phase: PARTICIPANT_UPLOAD_PHASE.PROCESSING,
  },
  {
    key: "submission-1",
    orderIndex: 1,
    phase: COMPLETED_PHASE,
  },
];

describe("upload-status-realtime", () => {
  it("parses object and JSON string payloads", () => {
    expect(
      parseUploadRealtimeEventData({
        reference: "AB12",
        orderIndex: 2,
        outcome: "success",
      }),
    ).toEqual({
      reference: "AB12",
      orderIndex: 2,
      outcome: "success",
    });

    expect(
      parseUploadRealtimeEventData(
        JSON.stringify({
          reference: "AB12",
          orderIndex: 1,
          outcome: "error",
        }),
      ),
    ).toEqual({
      reference: "AB12",
      orderIndex: 1,
      outcome: "error",
    });
  });

  it("ignores malformed payloads safely", () => {
    expect(parseUploadRealtimeEventData("not-json")).toBeNull();
    expect(parseUploadRealtimeEventData(42)).toBeNull();
  });

  it("resolves the matching file for realtime submission completion", () => {
    expect(getRealtimeSubmissionCompletion(files, 0, COMPLETED_PHASE)).toEqual({
      key: "submission-0",
      shouldUpdate: true,
    });
  });

  it("treats duplicate completion events as idempotent", () => {
    expect(getRealtimeSubmissionCompletion(files, 1, COMPLETED_PHASE)).toEqual({
      key: "submission-1",
      shouldUpdate: false,
    });
  });

  it("does not complete the flow early when a file is still incomplete", () => {
    expect(shouldCompleteUploadFlow(files, true, COMPLETED_PHASE)).toBe(false);
    expect(
      shouldCompleteUploadFlow(
        [
          {
            key: "submission-0",
            orderIndex: 0,
            phase: COMPLETED_PHASE,
          },
          {
            key: "submission-1",
            orderIndex: 1,
            phase: COMPLETED_PHASE,
          },
        ],
        true,
        COMPLETED_PHASE,
      ),
    ).toBe(true);
  });

  it("flags realtime error outcomes for reconciliation", () => {
    expect(shouldReconcileUploadStatus("error")).toBe(true);
    expect(shouldReconcileUploadStatus("success")).toBe(false);
    expect(shouldReconcileUploadStatus(undefined)).toBe(false);
  });

  it("returns polling completion keys for missed realtime events", () => {
    expect(
      getPollingCompletionKeys(
        files,
        [
          { key: "submission-0", uploaded: true },
          { key: "submission-1", uploaded: true },
          { key: "submission-2", uploaded: false },
        ],
        COMPLETED_PHASE,
      ),
    ).toEqual(["submission-0"]);
  });
});
