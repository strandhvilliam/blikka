export const PARTICIPANT_SUBMISSION_STEPS = {
  ParticipantNumberStep: 1,
  ParticipantDetailsStep: 2,
  ClassSelectionStep: 3,
  DeviceSelectionStep: 4,
  UploadSubmissionStep: 5,
} as const;

export const BY_CAMERA_STEPS = {
  ParticipantNumberStep: 1,
  ParticipantDetailsStep: 2,
  DeviceSelectionStep: 3,
  UploadSubmissionStep: 4,
} as const;

export type FlowMode = "marathon" | "by-camera";

export const PARTICIPANT_REF_LENGTH = 4;

export const UPLOAD_TIMEOUT_MS = 1000 * 60 * 3; // 3 minutes
export const UPLOAD_CONCURRENCY_LIMIT = 1;
export const UPLOAD_STATUS_RECONCILIATION_INTERVAL_MS = 15000; // 15 seconds
