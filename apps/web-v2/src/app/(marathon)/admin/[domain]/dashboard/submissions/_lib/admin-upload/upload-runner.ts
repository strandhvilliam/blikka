import {
  ADMIN_UPLOAD_PHASE,
  type AdminPreparedUpload,
  type AdminUploadError,
  type AdminUploadErrorCode,
  type AdminUploadFileState,
} from "./types";

interface UploadPreparedFilesInput {
  files: AdminPreparedUpload[];
  onFileStateChange: (
    key: string,
    patch: Partial<Pick<AdminUploadFileState, "phase" | "progress" | "error">>,
  ) => void;
  timeoutMs?: number;
}

export const ADMIN_UPLOAD_TIMEOUT_MS = 1000 * 60 * 3;

function classifyUploadError(
  error: Error,
  httpStatus?: number,
): AdminUploadErrorCode {
  const message = error.message.toLowerCase();

  if (httpStatus) {
    if (httpStatus === 413) return "FILE_TOO_LARGE";
    if (httpStatus === 403) return "UNAUTHORIZED";
    if (httpStatus === 429) return "RATE_LIMITED";
    if (httpStatus >= 500) return "SERVER_ERROR";
  }

  if (error.name === "AbortError") return "TIMEOUT";
  if (message.includes("network") || message.includes("fetch"))
    return "NETWORK_ERROR";
  if (message.includes("timeout")) return "TIMEOUT";

  return "UNKNOWN";
}

function createUploadError(
  error: Error,
  httpStatus?: number,
): AdminUploadError {
  return {
    message: error.message,
    code: classifyUploadError(error, httpStatus),
    timestamp: new Date(),
    httpStatus,
  };
}

async function uploadSingleFile(
  file: AdminPreparedUpload,
  onFileStateChange: UploadPreparedFilesInput["onFileStateChange"],
  timeoutMs: number,
): Promise<{ key: string; success: boolean }> {
  const controller = new AbortController();

  onFileStateChange(file.key, {
    phase: ADMIN_UPLOAD_PHASE.UPLOADING,
    progress: 0,
    error: undefined,
  });

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(file.presignedUrl, {
      method: "PUT",
      body: file.file,
      signal: controller.signal,
      headers: {
        "Content-Type": file.file.type || "image/jpeg",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(
        `Upload failed: ${response.status} ${response.statusText}`,
      );
      onFileStateChange(file.key, {
        phase: ADMIN_UPLOAD_PHASE.ERROR,
        progress: 0,
        error: createUploadError(error, response.status),
      });
      return { key: file.key, success: false };
    }

    onFileStateChange(file.key, {
      phase: ADMIN_UPLOAD_PHASE.PROCESSING,
      progress: 100,
      error: undefined,
    });

    return { key: file.key, success: true };
  } catch (error) {
    clearTimeout(timeoutId);

    const parsedError =
      error instanceof Error ? error : new Error("Unknown upload error");

    onFileStateChange(file.key, {
      phase: ADMIN_UPLOAD_PHASE.ERROR,
      progress: 0,
      error: createUploadError(parsedError),
    });

    return { key: file.key, success: false };
  }
}

export async function uploadPreparedFiles({
  files,
  onFileStateChange,
  timeoutMs = ADMIN_UPLOAD_TIMEOUT_MS,
}: UploadPreparedFilesInput): Promise<{
  successKeys: string[];
  failedKeys: string[];
}> {
  const successKeys: string[] = [];
  const failedKeys: string[] = [];

  for (const file of files) {
    const result = await uploadSingleFile(file, onFileStateChange, timeoutMs);
    if (result.success) {
      successKeys.push(result.key);
    } else {
      failedKeys.push(result.key);
    }
  }

  return { successKeys, failedKeys };
}
