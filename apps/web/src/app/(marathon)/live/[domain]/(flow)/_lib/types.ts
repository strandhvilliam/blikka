import type {
  ClientUploadError,
  ClientUploadErrorCode,
} from "@/lib/upload-client";

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
export type FileUploadErrorCode = ClientUploadErrorCode;
export type FileUploadError = ClientUploadError;

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
