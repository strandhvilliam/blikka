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

export type FlowMode = 'marathon' | 'by-camera'
export type FlowVariant = 'upload' | 'prepare'

export const PARTICIPANT_REF_LENGTH = 4

/** By-camera selected-photo preview: caps on-screen height for very tall (portrait) thumbnails. */
export const BY_CAMERA_PREVIEW_MAX_HEIGHT_CLASS = 'max-h-[min(52dvh,30rem)]'

export const UPLOAD_TIMEOUT_MS = 1000 * 60 * 3 // 3 minutes
export const UPLOAD_CONCURRENCY_LIMIT = 1
export const UPLOAD_STATUS_RECONCILIATION_INTERVAL_MS = 15000 // 15 seconds
export const MIN_UPLOAD_PROGRESS_DISPLAY_MS = 3000 // 3 seconds
export const PARTICIPANT_FINALIZATION_POLL_INTERVAL_MS = 5000 // 5 seconds

/**
 * Poll intervals used while the realtime stream is connected.
 *
 * Realtime is the primary signal there and the poll is only a safety net, so it runs far
 * slower. This matters at event scale: with 1000 participants finalizing, the difference
 * between a 5 s and a 15 s finalization poll is ~200 req/s vs ~67 req/s.
 */
export const UPLOAD_STATUS_RECONCILIATION_REALTIME_INTERVAL_MS = 45000 // 45 seconds
export const PARTICIPANT_FINALIZATION_REALTIME_POLL_INTERVAL_MS = 15000 // 15 seconds
export const PARTICIPANT_FINALIZATION_TIMEOUT_MS = 1000 * 60 * 2 // 2 minutes

/** Retries for status queries during upload finalization (transient network). */
export const UPLOAD_FLOW_STATUS_QUERY_RETRY_COUNT = 3
export const UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS = 10_000
