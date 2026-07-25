import {
  PARTICIPANT_UPLOAD_PHASE,
  type ParticipantPreparedUpload,
  type ParticipantUploadFileState,
  type ParticipantUploadPhase,
} from './participant-upload-types'
import { CLIENT_UPLOAD_TIMEOUT_MS, uploadFileToPresignedUrl } from '@/lib/upload-client'

interface UploadManualFilesInput {
  files: ParticipantPreparedUpload[]
  onFileStateChange: (
    key: string,
    patch: Partial<Pick<ParticipantUploadFileState, 'phase' | 'progress' | 'error'>>,
  ) => void
  timeoutMs?: number
  /**
   * Phase a file moves to once its S3 upload succeeds. Defaults to PROCESSING — the
   * file is in S3 but still awaits server-side processing (the by-camera flow polls
   * for that). Flows that treat the S3 upload itself as "done" (staff marathon
   * uploads) pass COMPLETED so each file reads as finished the moment it lands.
   */
  uploadedPhase?: ParticipantUploadPhase
}

export const PARTICIPANT_UPLOAD_TIMEOUT_MS = CLIENT_UPLOAD_TIMEOUT_MS

async function uploadSingleFile(
  file: ParticipantPreparedUpload,
  onFileStateChange: UploadManualFilesInput['onFileStateChange'],
  timeoutMs: number,
  uploadedPhase: ParticipantUploadPhase,
): Promise<{ key: string; success: boolean }> {
  onFileStateChange(file.key, {
    phase: PARTICIPANT_UPLOAD_PHASE.UPLOADING,
    progress: 0,
    error: undefined,
  })

  const result = await uploadFileToPresignedUrl({
    file: file.file,
    presignedUrl: file.presignedUrl,
    timeoutMs,
    contentType: file.contentType,
  })

  if (!result.ok) {
    onFileStateChange(file.key, {
      phase: PARTICIPANT_UPLOAD_PHASE.ERROR,
      progress: 0,
      error: result.error,
    })
    return { key: file.key, success: false }
  }

  onFileStateChange(file.key, {
    phase: uploadedPhase,
    progress: 100,
    error: undefined,
  })

  return { key: file.key, success: true }
}

export async function uploadManualFiles({
  files,
  onFileStateChange,
  timeoutMs = CLIENT_UPLOAD_TIMEOUT_MS,
  uploadedPhase = PARTICIPANT_UPLOAD_PHASE.PROCESSING,
}: UploadManualFilesInput): Promise<{
  successKeys: string[]
  failedKeys: string[]
}> {
  const successKeys: string[] = []
  const failedKeys: string[] = []

  for (const file of files) {
    const result = await uploadSingleFile(file, onFileStateChange, timeoutMs, uploadedPhase)
    if (result.success) {
      successKeys.push(result.key)
    } else {
      failedKeys.push(result.key)
    }
  }

  return { successKeys, failedKeys }
}
