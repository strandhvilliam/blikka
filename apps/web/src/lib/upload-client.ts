export const CLIENT_UPLOAD_TIMEOUT_MS = 1000 * 60 * 3;

export type ClientUploadErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "FILE_TOO_LARGE"
  | "UNAUTHORIZED"
  | "SERVER_ERROR"
  | "RATE_LIMITED"
  | "INVALID_FILE_TYPE"
  | "UNKNOWN";

export interface ClientUploadError {
  message: string;
  code: ClientUploadErrorCode;
  timestamp: Date;
  httpStatus?: number;
}

export function classifyUploadError(
  error: Error,
  httpStatus?: number,
): ClientUploadErrorCode {
  const message = error.message.toLowerCase();

  if (httpStatus) {
    if (httpStatus === 413) return "FILE_TOO_LARGE";
    if (httpStatus === 403) return "UNAUTHORIZED";
    if (httpStatus === 429) return "RATE_LIMITED";
    if (httpStatus >= 500) return "SERVER_ERROR";
  }

  if (error.name === "AbortError") return "TIMEOUT";
  if (message.includes("network") || message.includes("fetch")) {
    return "NETWORK_ERROR";
  }
  if (message.includes("timeout")) return "TIMEOUT";
  if (message.includes("too large") || message.includes("413")) {
    return "FILE_TOO_LARGE";
  }
  if (message.includes("forbidden") || message.includes("403")) {
    return "UNAUTHORIZED";
  }
  if (message.includes("rate limit") || message.includes("429")) {
    return "RATE_LIMITED";
  }

  return "UNKNOWN";
}

export function createUploadError(
  error: Error,
  httpStatus?: number,
): ClientUploadError {
  return {
    message: error.message,
    code: classifyUploadError(error, httpStatus),
    timestamp: new Date(),
    httpStatus,
  };
}

export async function uploadFileToPresignedUrl({
  file,
  presignedUrl,
  timeoutMs = CLIENT_UPLOAD_TIMEOUT_MS,
}: {
  file: File;
  presignedUrl: string;
  timeoutMs?: number;
}): Promise<{ ok: true } | { ok: false; error: ClientUploadError }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(presignedUrl, {
      method: "PUT",
      body: file,
      signal: controller.signal,
      headers: {
        "Content-Type": file.type || "image/jpeg",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(
        `Upload failed: ${response.status} ${response.statusText}`,
      );

      return {
        ok: false,
        error: createUploadError(error, response.status),
      };
    }

    return { ok: true };
  } catch (error) {
    clearTimeout(timeoutId);

    const parsedError =
      error instanceof Error ? error : new Error("Unknown upload error");

    return {
      ok: false,
      error: createUploadError(parsedError),
    };
  }
}

export function attachPresignedUrls<
  T extends object,
  TPresignedUrl extends { key: string; url: string },
>(
  items: T[],
  presignedUrls: TPresignedUrl[],
): Array<T & { key: string; presignedUrl: string }> {
  return items.map((item, index) => {
    const urlInfo = presignedUrls[index];

    if (!urlInfo) {
      throw new Error(`Missing presigned URL for item ${index}`);
    }

    return {
      ...item,
      key: urlInfo.key,
      presignedUrl: urlInfo.url,
    };
  });
}
