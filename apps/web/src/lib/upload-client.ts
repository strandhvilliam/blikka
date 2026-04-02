export const CLIENT_UPLOAD_TIMEOUT_MS = 1000 * 60 * 3

const MAX_RAW_RESPONSE_SNIPPET_LENGTH = 300

export type ClientUploadErrorCode =
  | "NETWORK_OFFLINE"
  | "NETWORK_UNREACHABLE"
  | "TIMEOUT"
  | "FIREWALL_OR_PROXY_BLOCKED"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE"
  | "UPLOAD_URL_EXPIRED"
  | "UPLOAD_SIGNATURE_INVALID"
  | "AWS_TEMPORARY"
  | "AWS_FORBIDDEN"
  | "AWS_BAD_REQUEST"
  | "UNKNOWN"

export type ClientUploadErrorSource = "browser" | "aws" | "app"

export type ClientUploadRetryMode = "same-url" | "refresh-url" | "restart-flow" | "none"

export interface ClientUploadError {
  message: string
  code: ClientUploadErrorCode
  source: ClientUploadErrorSource
  timestamp: Date
  friendlyMessageKey: string
  friendlyActionKey?: string
  retriable: boolean
  retryMode: ClientUploadRetryMode
  httpStatus?: number
  awsCode?: string
  awsMessage?: string
  awsRequestId?: string
  awsHostId?: string
  rawResponseSnippet?: string
}

interface S3ErrorDetails {
  code?: string
  message?: string
  requestId?: string
  hostId?: string
  rawResponseSnippet?: string
}

function readS3XmlTag(body: string, tagName: string) {
  const match = body.match(new RegExp(`<${tagName}>([^<]+)</${tagName}>`, "i"))
  return match?.[1]?.trim()
}

function toRawResponseSnippet(body: string) {
  const normalized = body.replace(/\s+/g, " ").trim()
  if (normalized.length <= MAX_RAW_RESPONSE_SNIPPET_LENGTH) {
    return normalized || undefined
  }

  return `${normalized.slice(0, MAX_RAW_RESPONSE_SNIPPET_LENGTH)}...`
}

function parseS3ErrorResponse(body: string): S3ErrorDetails | undefined {
  const trimmed = body.trim()
  if (!trimmed.includes("<Error")) {
    return undefined
  }

  return {
    code: readS3XmlTag(trimmed, "Code"),
    message: readS3XmlTag(trimmed, "Message"),
    requestId: readS3XmlTag(trimmed, "RequestId"),
    hostId: readS3XmlTag(trimmed, "HostId"),
    rawResponseSnippet: toRawResponseSnippet(trimmed),
  }
}

function getFriendlyMessageKey(code: ClientUploadErrorCode) {
  switch (code) {
    case "NETWORK_OFFLINE":
      return "errorOfflineBody"
    case "TIMEOUT":
      return "errorTimeoutBody"
    case "NETWORK_UNREACHABLE":
    case "FIREWALL_OR_PROXY_BLOCKED":
      return "errorNetworkBlockedBody"
    case "FILE_TOO_LARGE":
      return "errorFileTooLargeBody"
    case "INVALID_FILE":
      return "errorInvalidFileBody"
    case "UPLOAD_URL_EXPIRED":
    case "UPLOAD_SIGNATURE_INVALID":
    case "AWS_FORBIDDEN":
      return "errorExpiredBody"
    case "AWS_TEMPORARY":
      return "errorTemporaryAwsBody"
    case "AWS_BAD_REQUEST":
      return "errorInvalidFileBody"
    case "UNKNOWN":
      return "errorUnknownBody"
    default:
      return "errorUnknownBody"
  }
}

function getFriendlyActionKey(code: ClientUploadErrorCode) {
  switch (code) {
    case "NETWORK_OFFLINE":
      return "errorOfflineAction"
    case "TIMEOUT":
      return "errorTimeoutAction"
    case "NETWORK_UNREACHABLE":
    case "FIREWALL_OR_PROXY_BLOCKED":
      return "errorNetworkBlockedAction"
    case "FILE_TOO_LARGE":
      return "errorFileTooLargeAction"
    case "INVALID_FILE":
    case "AWS_BAD_REQUEST":
      return "errorInvalidFileAction"
    case "UPLOAD_URL_EXPIRED":
    case "UPLOAD_SIGNATURE_INVALID":
    case "AWS_FORBIDDEN":
      return "errorExpiredAction"
    case "AWS_TEMPORARY":
      return "errorTemporaryAwsAction"
    case "UNKNOWN":
      return "errorUnknownAction"
    default:
      return undefined
  }
}

export function classifyUploadError({
  error,
  httpStatus,
  awsCode,
}: {
  error: Error
  httpStatus?: number
  awsCode?: string
}): ClientUploadErrorCode {
  const message = error.message.toLowerCase()
  const normalizedAwsCode = awsCode?.trim()

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "NETWORK_OFFLINE"
  }

  if (error.name === "AbortError") {
    return "TIMEOUT"
  }

  if (
    normalizedAwsCode === "EntityTooLarge" ||
    httpStatus === 413 ||
    message.includes("too large")
  ) {
    return "FILE_TOO_LARGE"
  }

  if (
    normalizedAwsCode === "BadDigest" ||
    normalizedAwsCode === "InvalidDigest" ||
    normalizedAwsCode === "InvalidRequest" ||
    normalizedAwsCode === "InvalidArgument"
  ) {
    return "INVALID_FILE"
  }

  if (
    normalizedAwsCode === "RequestTimeTooSkewed" ||
    normalizedAwsCode === "RequestExpired" ||
    normalizedAwsCode === "ExpiredToken"
  ) {
    return "UPLOAD_URL_EXPIRED"
  }

  if (normalizedAwsCode === "SignatureDoesNotMatch") {
    return "UPLOAD_SIGNATURE_INVALID"
  }

  if (
    normalizedAwsCode === "RequestTimeout" ||
    normalizedAwsCode === "SlowDown" ||
    normalizedAwsCode === "InternalError" ||
    (httpStatus !== undefined && httpStatus >= 500)
  ) {
    return "AWS_TEMPORARY"
  }

  if (normalizedAwsCode === "AccessDenied" || httpStatus === 403) {
    return "AWS_FORBIDDEN"
  }

  if (
    normalizedAwsCode !== undefined ||
    (httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500)
  ) {
    return "AWS_BAD_REQUEST"
  }

  if (error instanceof TypeError && message.includes("fetch")) {
    return "NETWORK_UNREACHABLE"
  }

  if (error instanceof TypeError) {
    return "FIREWALL_OR_PROXY_BLOCKED"
  }

  return "UNKNOWN"
}

function getRetryMode(code: ClientUploadErrorCode): ClientUploadRetryMode {
  switch (code) {
    case "UPLOAD_URL_EXPIRED":
    case "UPLOAD_SIGNATURE_INVALID":
    case "AWS_FORBIDDEN":
      return "refresh-url"
    case "FILE_TOO_LARGE":
    case "INVALID_FILE":
      return "none"
    case "NETWORK_OFFLINE":
    case "NETWORK_UNREACHABLE":
    case "FIREWALL_OR_PROXY_BLOCKED":
    case "TIMEOUT":
    case "AWS_TEMPORARY":
    case "AWS_BAD_REQUEST":
    case "UNKNOWN":
      return "same-url"
    default:
      return "same-url"
  }
}

function createUploadError({
  error,
  httpStatus,
  source,
  awsCode,
  awsMessage,
  awsRequestId,
  awsHostId,
  rawResponseSnippet,
}: {
  error: Error
  httpStatus?: number
  source: ClientUploadErrorSource
  awsCode?: string
  awsMessage?: string
  awsRequestId?: string
  awsHostId?: string
  rawResponseSnippet?: string
}): ClientUploadError {
  const code = classifyUploadError({ error, httpStatus, awsCode })
  const retryMode = getRetryMode(code)

  return {
    message: error.message,
    code,
    source,
    timestamp: new Date(),
    friendlyMessageKey: getFriendlyMessageKey(code),
    friendlyActionKey: getFriendlyActionKey(code),
    retriable: retryMode !== "none",
    retryMode,
    httpStatus,
    awsCode,
    awsMessage,
    awsRequestId,
    awsHostId,
    rawResponseSnippet,
  }
}

export async function uploadFileToPresignedUrl({
  file,
  presignedUrl,
  timeoutMs = CLIENT_UPLOAD_TIMEOUT_MS,
  contentType,
}: {
  file: File
  presignedUrl: string
  timeoutMs?: number
  /** When set, must match the Content-Type used to sign the presigned URL. */
  contentType?: string
}): Promise<{ ok: true } | { ok: false; error: ClientUploadError }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  const resolvedContentType = contentType ?? (file.type || "image/jpeg")

  try {
    const response = await fetch(presignedUrl, {
      method: "PUT",
      body: file,
      signal: controller.signal,
      headers: {
        "Content-Type": resolvedContentType,
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const rawBody = await response.text().catch(() => "")
      const parsedS3Error = parseS3ErrorResponse(rawBody)
      const awsRequestId =
        parsedS3Error?.requestId ?? response.headers.get("x-amz-request-id") ?? undefined
      const awsHostId =
        parsedS3Error?.hostId ?? response.headers.get("x-amz-id-2") ?? undefined
      const message = parsedS3Error?.message
        ? `Upload failed: ${parsedS3Error.message}`
        : `Upload failed: ${response.status} ${response.statusText}`

      return {
        ok: false,
        error: createUploadError({
          error: new Error(message),
          httpStatus: response.status,
          source: parsedS3Error || awsRequestId || awsHostId ? "aws" : "app",
          awsCode: parsedS3Error?.code,
          awsMessage: parsedS3Error?.message,
          awsRequestId,
          awsHostId,
          rawResponseSnippet: parsedS3Error?.rawResponseSnippet ?? toRawResponseSnippet(rawBody),
        }),
      }
    }

    return { ok: true }
  } catch (error) {
    clearTimeout(timeoutId)

    const parsedError =
      error instanceof Error ? error : new Error("Unknown upload error")

    return {
      ok: false,
      error: createUploadError({
        error: parsedError,
        source: "browser",
      }),
    }
  }
}
