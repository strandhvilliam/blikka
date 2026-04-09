import * as Sentry from "@sentry/nextjs"
import type { ClientUploadError } from "./upload-client"

function clientOnly(): boolean {
  return typeof window !== "undefined"
}

const MAX_BREADCRUMB_STACK_CHARS = 6000

/** Rich, JSON-safe snapshot of any thrown value for breadcrumbs / extras (stacks, causes, DOMException). */
export function serializeUnknownErrorForLog(
  error: unknown,
  depth = 0,
): Record<string, unknown> {
  const maxDepth = 6
  if (depth > maxDepth) {
    return { kind: "truncated_cause_chain", depth }
  }

  if (error == null) {
    return { kind: "nullish", value: String(error) }
  }

  if (typeof error === "string" || typeof error === "number" || typeof error === "boolean") {
    return { kind: "primitive", value: error }
  }

  if (typeof error !== "object") {
    return { kind: "non_object", value: String(error) }
  }

  if (typeof AggregateError !== "undefined" && error instanceof AggregateError) {
    return {
      kind: "AggregateError",
      name: error.name,
      message: error.message,
      stack: truncateForBreadcrumb(error.stack),
      errors: error.errors.map((e) => serializeUnknownErrorForLog(e, depth + 1)),
    }
  }

  if (error instanceof Error) {
    const out: Record<string, unknown> = {
      kind: "Error",
      name: error.name,
      message: error.message,
      stack: truncateForBreadcrumb(error.stack),
    }
    const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined
    if (cause !== undefined) {
      out.cause = serializeUnknownErrorForLog(cause, depth + 1)
    }
    return out
  }

  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return {
      kind: "DOMException",
      name: error.name,
      message: error.message,
      code: error.code,
    }
  }

  try {
    return {
      kind: "object",
      constructor: (error as object).constructor?.name,
      stringified: JSON.stringify(error),
    }
  } catch {
    return {
      kind: "object_unserializable",
      constructor: (error as object).constructor?.name,
    }
  }
}

function truncateForBreadcrumb(stack: string | undefined): string | undefined {
  if (stack == null) return undefined
  if (stack.length <= MAX_BREADCRUMB_STACK_CHARS) return stack
  return `${stack.slice(0, MAX_BREADCRUMB_STACK_CHARS)}…`
}

/** Safe file metadata for Sentry (no full paths or original filenames). */
export function fileSummaryForSentry(file: File | Blob) {
  const name = file instanceof File ? file.name : ""
  const ext = name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : ""
  return {
    type: file instanceof File ? file.type || "unknown" : file.type || "unknown",
    size: file.size,
    ext: ext || undefined,
  }
}

export function byCameraBreadcrumb(message: string, data?: Record<string, unknown>) {
  if (!clientOnly()) return
  Sentry.addBreadcrumb({
    category: "by_camera_upload",
    message,
    level: "info",
    data,
  })
}

export function byCameraThumbnailBreadcrumb(
  outcome: "jpeg_thumbnail" | "fallback_no_2d_context" | "fallback_after_exception",
  data?: Record<string, unknown>,
) {
  if (!clientOnly()) return
  Sentry.addBreadcrumb({
    category: "by_camera_thumbnail",
    message: outcome,
    level: "info",
    data,
  })
}

export function captureByCameraMessage(
  message: string,
  options: {
    level?: "fatal" | "error" | "warning" | "log" | "info" | "debug"
    extra?: Record<string, unknown>
  } = {},
) {
  if (!clientOnly()) return
  Sentry.captureMessage(message, {
    level: options.level ?? "warning",
    tags: { flow: "by_camera" },
    extra: options.extra,
  })
}

export function captureByCameraException(error: unknown, extra?: Record<string, unknown>) {
  if (!clientOnly()) return
  Sentry.captureException(error, {
    tags: { flow: "by_camera" },
    extra,
  })
}

/** Full client-side S3 PUT error payload for Sentry (matches `ClientUploadError`). */
function clientUploadErrorToSentryExtras(error: ClientUploadError): Record<string, unknown> {
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
  }
}

export function captureByCameraS3UploadFailed(
  orderIndex: number,
  error: ClientUploadError,
  options?: {
    submissionKey?: string
    /** Same file as PUT body — size/type/ext for correlating with decode / device issues */
    file?: File
    /** Effective Content-Type header on the presigned PUT (must match signature) */
    requestContentType?: string
  },
) {
  if (!clientOnly()) return

  const extras: Record<string, unknown> = {
    orderIndex,
    ...clientUploadErrorToSentryExtras(error),
  }
  if (options?.submissionKey !== undefined) {
    extras.submissionKey = options.submissionKey
  }
  if (options?.file !== undefined) {
    extras.file = fileSummaryForSentry(options.file)
  }
  if (options?.requestContentType !== undefined) {
    extras.requestContentType = options.requestContentType
  }

  Sentry.captureMessage(error.message || "s3_presigned_put_failed", {
    level: "error",
    tags: {
      upload: "presigned_s3_put",
      upload_error_code: error.code,
      ...(error.awsCode != null && error.awsCode !== "" ? { aws_error_code: error.awsCode } : {}),
      ...(error.httpStatus != null ? { http_status: String(error.httpStatus) } : {}),
    },
    extra: extras,
    fingerprint: [
      "s3-presigned-put",
      error.code,
      error.awsCode ?? "no-aws-code",
      error.httpStatus != null ? String(error.httpStatus) : "no-status",
    ],
  })
}

export function summarizeFileListForSentry(files: File[]) {
  return {
    count: files.length,
    items: files.map((f) => fileSummaryForSentry(f)),
  }
}
