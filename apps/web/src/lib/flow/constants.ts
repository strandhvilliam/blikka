import { TRPCClientError } from '@trpc/client'

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
export const MIN_UPLOAD_PROGRESS_DISPLAY_MS = 3000 // 3 seconds

/** The only finalization signal — no push channel nudges this along. */
export const PARTICIPANT_FINALIZATION_POLL_INTERVAL_MS = 4000 // 4 seconds

/** Continue even if the status hasn't settled — the photos are already in S3 by this point. */
export const PARTICIPANT_FINALIZATION_TIMEOUT_MS = 1000 * 60 // 1 minute

/** Retries for status queries during upload finalization (transient network). */
export const UPLOAD_FLOW_STATUS_QUERY_RETRY_COUNT = 3
export const UPLOAD_FLOW_STATUS_QUERY_MAX_RETRY_DELAY_MS = 10_000

/**
 * A 429 from the reference rate limit is a ceiling, not a transient fault —
 * retrying it is the exact behaviour the ceiling exists to stop. Everything else
 * keeps the normal retry budget.
 */
export function shouldRetryStatusQuery(failureCount: number, error: unknown): boolean {
  if (isTooManyRequestsError(error)) {
    return false
  }

  return failureCount < UPLOAD_FLOW_STATUS_QUERY_RETRY_COUNT
}

function isTooManyRequestsError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) {
    return false
  }

  const data: unknown = error.data
  if (typeof data !== 'object' || data === null) {
    return false
  }

  return Reflect.get(data, 'code') === 'TOO_MANY_REQUESTS'
}
