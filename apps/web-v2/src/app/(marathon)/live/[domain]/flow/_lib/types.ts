// Upload Phase constants
export const UPLOAD_PHASE = {
  PRESIGNED: "presigned",
  UPLOADING: "uploading",
  PROCESSING: "processing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

export type UploadPhase = (typeof UPLOAD_PHASE)[keyof typeof UPLOAD_PHASE];

// Selected photo before upload
export interface SelectedPhoto {
  file: File;
  exif: Record<string, unknown>;
  preview: string; // Object URL for preview
  orderIndex: number;
  preconvertedExif?: Record<string, unknown> | null; // EXIF from before HEIC conversion
}

// Photo combined with presigned URL for upload
export interface PhotoWithPresignedUrl extends SelectedPhoto {
  presignedUrl: string;
  key: string;
}

// Upload file state tracked during upload
export interface UploadFileState {
  key: string;
  orderIndex: number;
  file: File;
  presignedUrl: string;
  preview: string;

  // Upload state
  phase: UploadPhase;
  progress: number; // 0-100
  error?: FileUploadError;

  // Timestamps
  startedAt?: Date;
  completedAt?: Date;
}

// File upload error
export type FileUploadErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "FILE_TOO_LARGE"
  | "UNAUTHORIZED"
  | "SERVER_ERROR"
  | "RATE_LIMITED"
  | "INVALID_FILE_TYPE"
  | "UNKNOWN";

export interface FileUploadError {
  message: string;
  code: FileUploadErrorCode;
  timestamp: Date;
  httpStatus?: number;
}

// Upload status from server (polling response)
export interface UploadStatusResponse {
  participant: {
    expectedCount: number;
    processedIndexes: number[];
    validated: boolean;
    finalized: boolean;
    errors: string[];
  } | null;
  submissions: Array<{
    key: string;
    orderIndex: number;
    uploaded: boolean;
    thumbnailKey: string | null;
    exifProcessed: boolean;
  }>;
}

// HEIC conversion state
export interface HeicConversionState {
  isConverting: boolean;
  isCancelling: boolean;
  progress: {
    current: number;
    total: number;
  };
  currentFileName: string | null;
}

// Utility function to convert phase to display status
export function phaseToDisplayStatus(
  phase: UploadPhase,
): "pending" | "uploading" | "processing" | "completed" | "error" {
  switch (phase) {
    case UPLOAD_PHASE.PRESIGNED:
      return "pending";
    case UPLOAD_PHASE.UPLOADING:
      return "uploading";
    case UPLOAD_PHASE.PROCESSING:
      return "processing";
    case UPLOAD_PHASE.COMPLETED:
      return "completed";
    case UPLOAD_PHASE.ERROR:
      return "error";
    default:
      return "pending";
  }
}

// Error classification helper
export function classifyUploadError(
  error: Error,
  httpStatus?: number,
): FileUploadErrorCode {
  const message = error.message.toLowerCase();

  // HTTP status code based classification
  if (httpStatus) {
    if (httpStatus === 413) return "FILE_TOO_LARGE";
    if (httpStatus === 403) return "UNAUTHORIZED";
    if (httpStatus === 429) return "RATE_LIMITED";
    if (httpStatus >= 500) return "SERVER_ERROR";
  }

  // Error name/message based classification
  if (error.name === "AbortError") return "TIMEOUT";
  if (message.includes("network") || message.includes("fetch"))
    return "NETWORK_ERROR";
  if (message.includes("timeout")) return "TIMEOUT";
  if (message.includes("too large") || message.includes("413"))
    return "FILE_TOO_LARGE";
  if (message.includes("forbidden") || message.includes("403"))
    return "UNAUTHORIZED";
  if (message.includes("rate limit") || message.includes("429"))
    return "RATE_LIMITED";

  return "UNKNOWN";
}
