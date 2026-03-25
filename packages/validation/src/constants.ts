export const RULE_KEYS = {
  MAX_FILE_SIZE: "max_file_size",
  ALLOWED_FILE_TYPES: "allowed_file_types",
  STRICT_TIMESTAMP_ORDERING: "strict_timestamp_ordering",
  SAME_DEVICE: "same_device",
  WITHIN_TIMERANGE: "within_timerange",
  MODIFIED: "modified",
} as const;

/** Short UI labels when a rule fails or is shown in summaries (aligned with validation messages). */
export const RULE_KEY_DISPLAY_LABELS = {
  [RULE_KEYS.MAX_FILE_SIZE]: "Exceeds maximum file size",
  [RULE_KEYS.ALLOWED_FILE_TYPES]: "File type not allowed",
  [RULE_KEYS.STRICT_TIMESTAMP_ORDERING]: "Not in capture-time order",
  [RULE_KEYS.SAME_DEVICE]: "Multiple devices used",
  [RULE_KEYS.WITHIN_TIMERANGE]: "Outside configured timerange",
  [RULE_KEYS.MODIFIED]: "Possible editing or weak EXIF",
} as const satisfies Record<(typeof RULE_KEYS)[keyof typeof RULE_KEYS], string>;

/** Short UI labels when a rule passes (counterpart to {@link RULE_KEY_DISPLAY_LABELS}). */
export const RULE_KEY_PASSED_DISPLAY_LABELS = {
  [RULE_KEYS.MAX_FILE_SIZE]: "Within size limit",
  [RULE_KEYS.ALLOWED_FILE_TYPES]: "Valid file type",
  [RULE_KEYS.STRICT_TIMESTAMP_ORDERING]: "In capture-time order",
  [RULE_KEYS.SAME_DEVICE]: "Same device",
  [RULE_KEYS.WITHIN_TIMERANGE]: "Within configured timerange",
  [RULE_KEYS.MODIFIED]: "No editing indicators",
} as const satisfies Record<(typeof RULE_KEYS)[keyof typeof RULE_KEYS], string>;

export const IMAGE_EXTENSION_TO_MIME_TYPE = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
} as const;

export const VALIDATION_OUTCOME = {
  PASSED: "passed",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;

export const EDITING_SOFTWARE_KEYWORDS = [
  "photoshop",
  "lightroom",
  "gimp",
  "affinity",
  "capture one",
  "luminar",
  "pixlr",
  "snapseed",
  "acdsee",
  "paintshop",
] as const;
