import type { ValidationResult } from "@blikka/validation";
import type {
  ClientUploadError,
  ClientUploadErrorCode,
} from "@/lib/upload-client";

export const PARTICIPANT_UPLOAD_PHASE = {
  PRESIGNED: "presigned",
  UPLOADING: "uploading",
  PROCESSING: "processing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

export type ParticipantUploadPhase =
  (typeof PARTICIPANT_UPLOAD_PHASE)[keyof typeof PARTICIPANT_UPLOAD_PHASE];

export interface ParticipantSelectedPhoto {
  id: string;
  file: File;
  exif: Record<string, unknown>;
  previewUrl: string;
  orderIndex: number;
  preconvertedExif?: Record<string, unknown> | null;
}

export interface ParticipantPreparedUpload extends ParticipantSelectedPhoto {
  key: string;
  presignedUrl: string;
  /** From API; must match the presigned PUT signature when set. */
  contentType?: string;
}

export type ParticipantUploadErrorCode = ClientUploadErrorCode;

export type ParticipantUploadError = ClientUploadError;

export interface ParticipantUploadFileState extends ParticipantPreparedUpload {
  phase: ParticipantUploadPhase;
  progress: number;
  error?: ParticipantUploadError;
}

export interface ProcessSelectedFilesResult {
  photos: ParticipantSelectedPhoto[];
  warnings: string[];
  errors: string[];
}

export interface ParticipantValidationState {
  results: ValidationResult[];
  hasBlockingErrors: boolean;
}

