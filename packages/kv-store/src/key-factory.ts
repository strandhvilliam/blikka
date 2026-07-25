export const formatOrderIndex = (orderIndex: number) =>
  (Number(orderIndex) + 1).toString().padStart(2, '0')

/**
 * TTL for upload-session state (participant/submission/exif). The DB runs with eviction on,
 * so keys without one compete for the LRU pool against live sessions. Matches the
 * finalize-claim TTL.
 */
export const UPLOAD_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

export const Keys = {
  submission: (domain: string, ref: string, orderIndex: number) =>
    `submission:${domain}:${ref}:${formatOrderIndex(orderIndex)}`,
  exif: (domain: string, ref: string, orderIndex: number) =>
    `exif:${domain}:${ref}:${formatOrderIndex(orderIndex)}`,
  participant: (domain: string, ref: string) => `participant:${domain}:${ref}`,
  /** Idempotency token: one finalize bus emission per upload session. */
  finalizeEventClaim: (domain: string, ref: string, uploadSessionId: string) =>
    `finalize-event:${domain}:${ref}:${uploadSessionId}`,
} as const
