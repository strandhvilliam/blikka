export const formatOrderIndex = (orderIndex: number) =>
  (Number(orderIndex) + 1).toString().padStart(2, '0')

export const Keys = {
  submission: (domain: string, ref: string, orderIndex: number) =>
    `submission:${domain}:${ref}:${formatOrderIndex(orderIndex)}`,
  exif: (domain: string, ref: string, orderIndex: number) =>
    `exif:${domain}:${ref}:${formatOrderIndex(orderIndex)}`,
  participant: (domain: string, ref: string) => `participant:${domain}:${ref}`,
  /** Idempotency token: one finalize bus emission per upload session. */
  finalizeEventClaim: (domain: string, ref: string, uploadSessionId: string) =>
    `finalize-event:${domain}:${ref}:${uploadSessionId}`,
  downloadState: (jobId: string) => `download-state:${jobId}`,
  downloadStateFiles: (jobId: string) => `download-state:${jobId}:files`,
  downloadProcess: (processId: string) => `download-process:${processId}`,
  activeDownloadProcess: (domain: string) => `active-download-process:${domain}`,
  /**
   * Display fallback: the most recently initialized process for a domain. Unlike the active
   * pointer (used for the in-progress concurrency guard, and cleared on transient misses), this is
   * only overwritten by a new export or cleared on an explicit reset — so a completed export stays
   * visible in the dashboard even if the active pointer is gone.
   */
  lastDownloadProcess: (domain: string) => `last-download-process:${domain}`,
} as const
