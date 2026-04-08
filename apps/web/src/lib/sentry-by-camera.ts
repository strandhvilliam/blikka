import * as Sentry from "@sentry/nextjs";
import type { ClientUploadError } from "./upload-client";

function clientOnly(): boolean {
  return typeof window !== "undefined";
}

/** Safe file metadata for Sentry (no full paths or original filenames). */
export function fileSummaryForSentry(file: File | Blob) {
  const name = file instanceof File ? file.name : "";
  const ext = name.includes(".")
    ? (name.split(".").pop()?.toLowerCase() ?? "")
    : "";
  return {
    type: file instanceof File ? file.type || "unknown" : file.type || "unknown",
    size: file.size,
    ext: ext || undefined,
  };
}

export function byCameraBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
) {
  if (!clientOnly()) return;
  Sentry.addBreadcrumb({
    category: "by_camera_upload",
    message,
    level: "info",
    data,
  });
}

export function byCameraThumbnailBreadcrumb(
  outcome:
    | "jpeg_thumbnail"
    | "fallback_no_2d_context"
    | "fallback_after_exception",
  data?: Record<string, unknown>,
) {
  if (!clientOnly()) return;
  Sentry.addBreadcrumb({
    category: "by_camera_thumbnail",
    message: outcome,
    level: "info",
    data,
  });
}

export function captureByCameraMessage(
  message: string,
  options: {
    level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
    extra?: Record<string, unknown>;
  } = {},
) {
  if (!clientOnly()) return;
  Sentry.captureMessage(message, {
    level: options.level ?? "warning",
    tags: { flow: "by_camera" },
    extra: options.extra,
  });
}

export function captureByCameraException(
  error: unknown,
  extra?: Record<string, unknown>,
) {
  if (!clientOnly()) return;
  Sentry.captureException(error, {
    tags: { flow: "by_camera" },
    extra,
  });
}

export function captureByCameraS3UploadFailed(
  orderIndex: number,
  error: ClientUploadError,
) {
  if (!clientOnly()) return;
  Sentry.captureMessage("by_camera_s3_upload_failed", {
    level: "error",
    tags: {
      flow: "by_camera",
      upload_error_code: error.code,
    },
    extra: {
      orderIndex,
      retriable: error.retriable,
      retryMode: error.retryMode,
      source: error.source,
      httpStatus: error.httpStatus,
      awsCode: error.awsCode,
    },
  });
}

export function summarizeFileListForSentry(files: File[]) {
  return {
    count: files.length,
    items: files.map((f) => fileSummaryForSentry(f)),
  };
}
