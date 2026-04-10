export const PARTICIPANT_SUBMISSION_STEPS = {
  ParticipantNumberStep: 1,
  ParticipantDetailsStep: 2,
  ClassSelectionStep: 3,
  DeviceSelectionStep: 4,
  UploadSubmissionStep: 5,
} as const

export const PREPARE_PARTICIPANT_STEPS = {
  ParticipantNumberStep: 1,
  ParticipantDetailsStep: 2,
  ClassSelectionStep: 3,
  DeviceSelectionStep: 4,
  PrepareNextStep: 5,
} as const

export const BY_CAMERA_STEPS = {
  ParticipantDetailsStep: 1,
  DeviceSelectionStep: 2,
  UploadSubmissionStep: 3,
} as const

export type FlowMode = "marathon" | "by-camera"
export type FlowVariant = "upload" | "prepare"

export const PARTICIPANT_REF_LENGTH = 4

export const UPLOAD_TIMEOUT_MS = 1000 * 60 * 3 // 3 minutes
export const UPLOAD_CONCURRENCY_LIMIT = 1
export const UPLOAD_STATUS_RECONCILIATION_INTERVAL_MS = 15000 // 15 seconds
export const MIN_UPLOAD_PROGRESS_DISPLAY_MS = 3000 // 3 seconds
export const PARTICIPANT_FINALIZATION_POLL_INTERVAL_MS = 5000 // 5 seconds
export const PARTICIPANT_FINALIZATION_TIMEOUT_MS = 1000 * 60 * 2 // 2 minutes

/** Retries for status queries during upload finalization (transient network). */
export const UPLOAD_FLOW_STATUS_QUERY_RETRY_COUNT = 3
export const UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS = 10_000
