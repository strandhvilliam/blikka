import type { ClientUploadError } from "@/lib/upload-client"
import type { UploadFileState } from "./types"

export interface UploadErrorPresentation {
  titleKey: string
  bodyKey: string
  actionKey?: string
  retriable: boolean
  retryLabelKey: "retry" | "refreshAndRetry"
  technicalDetails?: {
    awsCode?: string
    awsRequestId?: string
    httpStatus?: number
  }
}

function getTitleKey(errorCode: ClientUploadError["code"]) {
  switch (errorCode) {
    case "NETWORK_OFFLINE":
      return "errorOfflineTitle"
    case "TIMEOUT":
      return "errorTimeoutTitle"
    case "NETWORK_UNREACHABLE":
    case "FIREWALL_OR_PROXY_BLOCKED":
      return "errorNetworkBlockedTitle"
    case "FILE_TOO_LARGE":
      return "errorFileTooLargeTitle"
    case "INVALID_FILE":
    case "AWS_BAD_REQUEST":
      return "errorInvalidFileTitle"
    case "UPLOAD_URL_EXPIRED":
    case "UPLOAD_SIGNATURE_INVALID":
    case "AWS_FORBIDDEN":
      return "errorExpiredTitle"
    case "AWS_TEMPORARY":
      return "errorTemporaryAwsTitle"
    case "UNKNOWN":
      return "errorUnknownTitle"
    default:
      return "errorUnknownTitle"
  }
}

export function getUploadErrorPresentation(
  error?: ClientUploadError,
): UploadErrorPresentation {
  if (!error) {
    return {
      titleKey: "errorUnknownTitle",
      bodyKey: "errorUnknownBody",
      actionKey: "errorUnknownAction",
      retriable: true,
      retryLabelKey: "retry",
    }
  }

  return {
    titleKey: getTitleKey(error.code),
    bodyKey: error.friendlyMessageKey,
    actionKey: error.friendlyActionKey,
    retriable: error.retriable,
    retryLabelKey: error.retryMode === "refresh-url" ? "refreshAndRetry" : "retry",
    technicalDetails:
      error.awsCode || error.awsRequestId || error.httpStatus
        ? {
            awsCode: error.awsCode,
            awsRequestId: error.awsRequestId,
            httpStatus: error.httpStatus,
          }
        : undefined,
  }
}

export function getUploadSummaryPresentation(files: UploadFileState[]) {
  const failedFiles = files.filter((file) => file.error)

  if (failedFiles.length === 0) {
    return null
  }

  const errorCounts = new Map<ClientUploadError["code"], number>()
  failedFiles.forEach((file) => {
    if (!file.error) return
    errorCounts.set(file.error.code, (errorCounts.get(file.error.code) ?? 0) + 1)
  })

  const dominantCode = [...errorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const dominantError =
    failedFiles.find((file) => file.error?.code === dominantCode)?.error ?? failedFiles[0]?.error

  if (!dominantError) {
    return null
  }

  return getUploadErrorPresentation(dominantError)
}
