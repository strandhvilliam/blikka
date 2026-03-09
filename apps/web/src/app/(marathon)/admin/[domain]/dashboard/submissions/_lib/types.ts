import type { ValidationResult } from "@blikka/validation";
import type {
  ClientUploadError,
  ClientUploadErrorCode,
} from "@/lib/upload-client";

export const ADMIN_UPLOAD_PHASE = {
  PRESIGNED: "presigned",
  UPLOADING: "uploading",
  PROCESSING: "processing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

export type AdminUploadPhase =
  (typeof ADMIN_UPLOAD_PHASE)[keyof typeof ADMIN_UPLOAD_PHASE];

export interface AdminSelectedPhoto {
  id: string;
  file: File;
  exif: Record<string, unknown>;
  previewUrl: string;
  orderIndex: number;
  preconvertedExif?: Record<string, unknown> | null;
}

export interface AdminPreparedUpload extends AdminSelectedPhoto {
  key: string;
  presignedUrl: string;
}

export type AdminUploadErrorCode = ClientUploadErrorCode;

export type AdminUploadError = ClientUploadError;

export interface AdminUploadFileState extends AdminPreparedUpload {
  phase: AdminUploadPhase;
  progress: number;
  error?: AdminUploadError;
}

export interface ProcessSelectedFilesResult {
  photos: AdminSelectedPhoto[];
  warnings: string[];
  errors: string[];
}

export interface AdminValidationState {
  results: ValidationResult[];
  hasBlockingErrors: boolean;
}
