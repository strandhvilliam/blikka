import {
  PARTICIPANT_UPLOAD_PHASE,
  type ParticipantPreparedUpload,
  type ParticipantUploadFileState,
} from "./types";
import {
  CLIENT_UPLOAD_TIMEOUT_MS,
  uploadFileToPresignedUrl,
} from "@/lib/upload-client";

interface UploadPreparedFilesInput {
  files: ParticipantPreparedUpload[];
  onFileStateChange: (
    key: string,
    patch: Partial<
      Pick<ParticipantUploadFileState, "phase" | "progress" | "error">
    >,
  ) => void;
  timeoutMs?: number;
}

export const PARTICIPANT_UPLOAD_TIMEOUT_MS = CLIENT_UPLOAD_TIMEOUT_MS;

async function uploadSingleFile(
  file: ParticipantPreparedUpload,
  onFileStateChange: UploadPreparedFilesInput["onFileStateChange"],
  timeoutMs: number,
): Promise<{ key: string; success: boolean }> {
  onFileStateChange(file.key, {
    phase: PARTICIPANT_UPLOAD_PHASE.UPLOADING,
    progress: 0,
    error: undefined,
  });

  const result = await uploadFileToPresignedUrl({
    file: file.file,
    presignedUrl: file.presignedUrl,
    timeoutMs,
  });

  if (!result.ok) {
    onFileStateChange(file.key, {
      phase: PARTICIPANT_UPLOAD_PHASE.ERROR,
      progress: 0,
      error: result.error,
    });
    return { key: file.key, success: false };
  }

  onFileStateChange(file.key, {
    phase: PARTICIPANT_UPLOAD_PHASE.PROCESSING,
    progress: 100,
    error: undefined,
  });

  return { key: file.key, success: true };
}

export async function uploadPreparedFiles({
  files,
  onFileStateChange,
  timeoutMs = CLIENT_UPLOAD_TIMEOUT_MS,
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

