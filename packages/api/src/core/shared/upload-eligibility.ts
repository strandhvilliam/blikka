import { Option } from 'effect'
import type { ParticipantState, SubmissionState } from '@blikka/kv-store'

export function isSuccessfulActiveTopicUpload({
  submissionStatus,
  participantState,
  submissionState,
  activeTopicOrderIndex,
}: {
  submissionStatus?: string | null
  participantState: Option.Option<ParticipantState>
  submissionState: Option.Option<SubmissionState>
  activeTopicOrderIndex: number
}): boolean {
  if (submissionStatus && submissionStatus !== 'initialized') {
    return true
  }

  if (
    Option.isSome(participantState) &&
    participantState.value.finalized &&
    participantState.value.orderIndexes.includes(activeTopicOrderIndex)
  ) {
    return true
  }

  if (Option.isSome(submissionState)) {
    const state = submissionState.value
    return state.uploaded || state.exifProcessed || state.thumbnailKey !== null
  }

  return false
}
