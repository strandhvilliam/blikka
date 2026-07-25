/** Allow medium-format ~100MP with headroom; above this treat as bomb / non-camera. */
export const MAX_DECODE_INPUT_PIXELS = 120_000_000

/**
 * Abuse / non-camera ceiling only. Real pro JPEGs are almost always far below this.
 * Do NOT use this as a marathon validation default.
 */
export const ABUSE_MAX_OBJECT_BYTES = 150 * 1024 * 1024

/**
 * Client preview skip threshold. Files at or above this size skip in-browser decode
 * and show a "large file" placeholder instead of a failure state.
 */
export const CLIENT_PREVIEW_MAX_FILE_BYTES = 40 * 1024 * 1024

/** Non-JPEG uploads in admin custom contact sheets stay on a tighter budget. */
export const MAX_NON_JPEG_IMAGE_FILE_BYTES = 25 * 1024 * 1024
