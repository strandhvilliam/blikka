import { describe, expect, it } from "vitest"
import type { ClientUploadError } from "@/lib/upload-client"
import {
  getUploadErrorPresentation,
  getUploadSummaryPresentation,
} from "./upload-error-presenter"
import type { UploadFileState } from "./types"
import { UPLOAD_PHASE } from "./types"

function createError(
  overrides: Partial<ClientUploadError> = {},
): ClientUploadError {
  return {
    message: "Upload failed",
    code: "UNKNOWN",
    source: "app",
    timestamp: new Date(),
    friendlyMessageKey: "errorUnknownBody",
    retriable: true,
    retryMode: "same-url",
    ...overrides,
  }
}

function createFile(overrides: Partial<UploadFileState> = {}): UploadFileState {
  return {
    key: "submission-key",
    orderIndex: 0,
    file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
    presignedUrl: "https://example.com/upload",
    preview: "/preview.jpg",
    phase: UPLOAD_PHASE.ERROR,
    progress: 0,
    ...overrides,
  }
}

describe("upload-error-presenter", () => {
  it("maps refresh-url failures to refresh retry label", () => {
    const presentation = getUploadErrorPresentation(
      createError({
        code: "UPLOAD_SIGNATURE_INVALID",
        friendlyMessageKey: "errorExpiredBody",
        friendlyActionKey: "errorExpiredAction",
        retryMode: "refresh-url",
      }),
    )

    expect(presentation.titleKey).toBe("errorExpiredTitle")
    expect(presentation.bodyKey).toBe("errorExpiredBody")
    expect(presentation.retryLabelKey).toBe("refreshAndRetry")
  })

  it("includes technical details only when present", () => {
    const withoutDetails = getUploadErrorPresentation(createError())
    const withDetails = getUploadErrorPresentation(
      createError({
        awsCode: "SignatureDoesNotMatch",
        awsRequestId: "request-123",
        httpStatus: 403,
      }),
    )

    expect(withoutDetails.technicalDetails).toBeUndefined()
    expect(withDetails.technicalDetails).toEqual({
      awsCode: "SignatureDoesNotMatch",
      awsRequestId: "request-123",
      httpStatus: 403,
    })
  })

  it("summarizes using the dominant failure category", () => {
    const summary = getUploadSummaryPresentation([
      createFile({
        key: "1",
        error: createError({
          code: "TIMEOUT",
          friendlyMessageKey: "errorTimeoutBody",
        }),
      }),
      createFile({
        key: "2",
        error: createError({
          code: "TIMEOUT",
          friendlyMessageKey: "errorTimeoutBody",
        }),
      }),
      createFile({
        key: "3",
        error: createError({
          code: "FILE_TOO_LARGE",
          friendlyMessageKey: "errorFileTooLargeBody",
          retryMode: "none",
          retriable: false,
        }),
      }),
    ])

    expect(summary?.titleKey).toBe("errorTimeoutTitle")
    expect(summary?.bodyKey).toBe("errorTimeoutBody")
  })
})
