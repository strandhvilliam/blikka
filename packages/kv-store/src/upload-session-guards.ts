import type { ParticipantState } from "./schema"

export type UploadSessionGuardReason = "missing-current-session" | "session-mismatch"

export function getUploadSessionId(
  state: Partial<Pick<ParticipantState, "uploadSessionId">>,
): string {
  return state.uploadSessionId ?? ""
}

export function isCurrentUploadSession({
  eventUploadSessionId,
  participantState,
}: {
  eventUploadSessionId: string
  participantState: ParticipantState
}): { matched: true } | { matched: false; reason: UploadSessionGuardReason } {
  const currentUploadSessionId = getUploadSessionId(participantState)
  if (!currentUploadSessionId) {
    return { matched: false, reason: "missing-current-session" }
  }

  if (eventUploadSessionId !== currentUploadSessionId) {
    return { matched: false, reason: "session-mismatch" }
  }

  return { matched: true }
}
