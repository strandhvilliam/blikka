import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyUploadError,
  createUploadError,
  uploadFileToPresignedUrl,
} from "./upload-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("upload-client", () => {
  it("maps status-based upload errors", () => {
    expect(classifyUploadError(new Error("too large"), 413)).toBe(
      "FILE_TOO_LARGE",
    );
    expect(classifyUploadError(new Error("forbidden"), 403)).toBe(
      "UNAUTHORIZED",
    );
    expect(classifyUploadError(new Error("slow down"), 429)).toBe(
      "RATE_LIMITED",
    );
    expect(classifyUploadError(new Error("boom"), 500)).toBe("SERVER_ERROR");
  });

  it("maps abort errors to timeout", () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });

    expect(classifyUploadError(abortError)).toBe("TIMEOUT");
  });

  it("returns a structured error for failed uploads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        statusText: "Payload Too Large",
      }),
    );

    const result = await uploadFileToPresignedUrl({
      file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      presignedUrl: "https://example.com/upload",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected upload to fail");
    }
    expect(result.error.code).toBe("FILE_TOO_LARGE");
  });

  it("returns timeout errors when fetch aborts", async () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const result = await uploadFileToPresignedUrl({
      file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      presignedUrl: "https://example.com/upload",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected upload to fail");
    }
    expect(result.error.code).toBe("TIMEOUT");
  });

  it("returns success for successful uploads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
      }),
    );

    await expect(
      uploadFileToPresignedUrl({
        file: new File(["image"], "photo.jpg", { type: "image/jpeg" }),
        presignedUrl: "https://example.com/upload",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("creates upload errors with timestamps", () => {
    const error = createUploadError(new Error("boom"), 500);

    expect(error.code).toBe("SERVER_ERROR");
    expect(error.httpStatus).toBe(500);
    expect(error.timestamp).toBeInstanceOf(Date);
  });
});
