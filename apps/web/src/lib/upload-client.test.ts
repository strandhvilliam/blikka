import { afterEach, describe, expect, it, vi } from "vitest"
import { classifyUploadError, uploadFileToPresignedUrl } from "./upload-client"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function stubOnlineStatus(isOnline: boolean) {
  vi.stubGlobal("navigator", {
    onLine: isOnline,
  })
}

function createResponse({
  ok,
  status,
  statusText,
  body = "",
  headers,
}: {
  ok: boolean
  status: number
  statusText: string
  body?: string
  headers?: Record<string, string>
}) {
  return {
    ok,
    status,
    statusText,
    text: vi.fn().mockResolvedValue(body),
    headers: {
      get: (name: string) => headers?.[name.toLowerCase()] ?? null,
    },
  }
}

describe("upload-client", () => {
  it("maps offline errors before anything else", () => {
    stubOnlineStatus(false)

    expect(
      classifyUploadError({
        error: new Error("Failed to fetch"),
      }),
    ).toBe("NETWORK_OFFLINE")
  })

  it("maps signature errors to refresh-url retry", async () => {
    stubOnlineStatus(true)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createResponse({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          body: `
            <Error>
              <Code>SignatureDoesNotMatch</Code>
              <Message>The request signature we calculated does not match the signature you provided.</Message>
              <RequestId>request-123</RequestId>
              <HostId>host-123</HostId>
            </Error>
          `,
        }),
      ),
    )

    const result = await uploadFileToPresignedUrl({
      file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      presignedUrl: "https://example.com/upload",
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error("Expected upload to fail")
    }

    expect(result.error.code).toBe("UPLOAD_SIGNATURE_INVALID")
    expect(result.error.retryMode).toBe("refresh-url")
    expect(result.error.awsCode).toBe("SignatureDoesNotMatch")
    expect(result.error.awsRequestId).toBe("request-123")
  })

  it("maps entity too large errors to file too large", async () => {
    stubOnlineStatus(true)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createResponse({
          ok: false,
          status: 413,
          statusText: "Payload Too Large",
          body: `
            <Error>
              <Code>EntityTooLarge</Code>
              <Message>Your proposed upload exceeds the maximum allowed object size.</Message>
            </Error>
          `,
        }),
      ),
    )

    const result = await uploadFileToPresignedUrl({
      file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      presignedUrl: "https://example.com/upload",
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error("Expected upload to fail")
    }

    expect(result.error.code).toBe("FILE_TOO_LARGE")
    expect(result.error.retriable).toBe(false)
  })

  it("maps temporary s3 failures to same-url retry", async () => {
    stubOnlineStatus(true)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createResponse({
          ok: false,
          status: 503,
          statusText: "Slow Down",
          body: `
            <Error>
              <Code>SlowDown</Code>
              <Message>Please reduce your request rate.</Message>
            </Error>
          `,
        }),
      ),
    )

    const result = await uploadFileToPresignedUrl({
      file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      presignedUrl: "https://example.com/upload",
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error("Expected upload to fail")
    }

    expect(result.error.code).toBe("AWS_TEMPORARY")
    expect(result.error.retryMode).toBe("same-url")
  })

  it("uses response headers when xml fields are missing", async () => {
    stubOnlineStatus(true)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createResponse({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          body: "Access denied",
          headers: {
            "x-amz-request-id": "request-header",
            "x-amz-id-2": "host-header",
          },
        }),
      ),
    )

    const result = await uploadFileToPresignedUrl({
      file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      presignedUrl: "https://example.com/upload",
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error("Expected upload to fail")
    }

    expect(result.error.awsRequestId).toBe("request-header")
    expect(result.error.awsHostId).toBe("host-header")
  })

  it("returns timeout errors when fetch aborts", async () => {
    stubOnlineStatus(true)
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    })

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError))

    const result = await uploadFileToPresignedUrl({
      file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      presignedUrl: "https://example.com/upload",
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error("Expected upload to fail")
    }
    expect(result.error.code).toBe("TIMEOUT")
    expect(result.error.retryMode).toBe("same-url")
  })

  it("maps fetch type errors to network unreachable", async () => {
    stubOnlineStatus(true)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))

    const result = await uploadFileToPresignedUrl({
      file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      presignedUrl: "https://example.com/upload",
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error("Expected upload to fail")
    }

    expect(result.error.code).toBe("NETWORK_UNREACHABLE")
  })

  it("returns success for successful uploads", async () => {
    stubOnlineStatus(true)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createResponse({
          ok: true,
          status: 200,
          statusText: "OK",
        }),
      ),
    )

    await expect(
      uploadFileToPresignedUrl({
        file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
        presignedUrl: "https://example.com/upload",
      }),
    ).resolves.toEqual({ ok: true })
  })
})
