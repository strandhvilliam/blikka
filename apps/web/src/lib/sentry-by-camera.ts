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

/** Full client-side S3 PUT error payload for Sentry (matches `ClientUploadError`). */
function clientUploadErrorToSentryExtras(
  error: ClientUploadError,
): Record<string, unknown> {
  return {
    clientErrorMessage: error.message,
    classifiedCode: error.code,
    source: error.source,
    httpStatus: error.httpStatus,
    awsCode: error.awsCode,
    awsMessage: error.awsMessage,
    awsRequestId: error.awsRequestId,
    awsHostId: error.awsHostId,
    rawResponseSnippet: error.rawResponseSnippet,
    friendlyMessageKey: error.friendlyMessageKey,
    friendlyActionKey: error.friendlyActionKey,
    retriable: error.retriable,
    retryMode: error.retryMode,
    timestamp: error.timestamp.toISOString(),
  };
}

export function captureByCameraS3UploadFailed(
  orderIndex: number,
  error: ClientUploadError,
  options?: { submissionKey?: string },
) {
  if (!clientOnly()) return;

  const extras: Record<string, unknown> = {
    orderIndex,
    ...clientUploadErrorSentryExtras(error),
  };
  if (options?.submissionKey !== undefined) {
    extras.submissionKey = options.submissionKey;
  }

  Sentry.captureMessage(error.message || "s3_presigned_put_failed", {
    level: "error",
    tags: {
      upload: "presigned_s3_put",
      upload_error_code: error.code,
      ...(error.awsCode != null && error.awsCode !== ""
        ? { aws_error_code: error.awsCode }
        : {}),
      ...(error.httpStatus != null
        ? { http_status: String(error.httpStatus) }
        : {}),
    },
    extra: extras,
    fingerprint: [
      "s3-presigned-put",
      error.code,
      error.awsCode ?? "no-aws-code",
      error.httpStatus != null ? String(error.httpStatus) : "no-status",
    ],
  });
}

export function summarizeFileListForSentry(files: File[]) {
  return {
    count: files.length,
    items: files.map((f) => fileSummaryForSentry(f)),
  };
}
