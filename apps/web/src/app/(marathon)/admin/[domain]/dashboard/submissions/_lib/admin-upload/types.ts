import type { ValidationResult } from "@blikka/validation";

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

export type AdminUploadErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "FILE_TOO_LARGE"
  | "UNAUTHORIZED"
  | "SERVER_ERROR"
  | "RATE_LIMITED"
  | "UNKNOWN";

export interface AdminUploadError {
  message: string;
  code: AdminUploadErrorCode;
  timestamp: Date;
  httpStatus?: number;
}

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

export const ADMIN_COMMON_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "heic",
  "heif",
  "png",
  "gif",
  "webp",
];
