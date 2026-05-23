import { formatDomainPathname } from '@/lib/utils'
import type { RealtimeEnrichedSubmissionTableRow, SubmissionTableRow } from './submissions-types'

/** Normalize array param: empty → undefined, single → keep as array for API */
export function normalizeIdArray(ids: number[] | null | undefined): number[] | undefined {
  if (!ids || ids.length === 0) return undefined
  return ids
}

export function getSubmissionRowHref({
  participant,
  marathonMode,
  domain,
}: {
  participant: RealtimeEnrichedSubmissionTableRow
  marathonMode?: string
  domain: string
}): string {
  const byCameraSubmissionHref =
    participant.activeTopicSubmissionId !== null
      ? `/admin/dashboard/submissions/${participant.reference}/${participant.activeTopicSubmissionId}`
      : `/admin/dashboard/submissions/${participant.reference}`

  return formatDomainPathname(
    marathonMode === 'by-camera'
      ? byCameraSubmissionHref
      : `/admin/dashboard/submissions/${participant.reference}`,
    domain,
  )
}

export function buildParticipantIndexes(participants: SubmissionTableRow[]) {
  const participantIds: number[] = []
  const participantIndexById = new Map<number, number>()
  const participantsById = new Map<number, SubmissionTableRow>()

  for (let index = 0; index < participants.length; index++) {
    const participant = participants[index]
    participantIds.push(participant.id)
    participantIndexById.set(participant.id, index)
    participantsById.set(participant.id, participant)
  }

  return { participantIds, participantIndexById, participantsById }
}

export function getSelectedParticipants(
  participants: SubmissionTableRow[],
  selectedIds: ReadonlySet<number>,
): SubmissionTableRow[] {
  return participants.filter((participant) => selectedIds.has(participant.id))
}

export function getSelectedReferences(participants: SubmissionTableRow[]): string[] {
  return participants.map((participant) => participant.reference)
}

export function getCompletableParticipantIds(participants: SubmissionTableRow[]): number[] {
  return participants
    .filter((participant) => participant.status !== 'completed' && participant.status !== 'verified')
    .map((participant) => participant.id)
}

export function getSubmissionIdsMissingExif(participants: SubmissionTableRow[]): number[] {
  return participants
    .filter(
      (participant) =>
        participant.activeTopicSubmissionId !== null &&
        participant.submissionHealth !== null &&
        !participant.submissionHealth.hasExif,
    )
    .map((participant) => participant.activeTopicSubmissionId)
    .filter((submissionId): submissionId is number => submissionId !== null)
}

export function getSubmissionIdsMissingThumbnail(participants: SubmissionTableRow[]): number[] {
  return participants
    .filter(
      (participant) =>
        participant.activeTopicSubmissionId !== null &&
        participant.submissionHealth !== null &&
        !participant.submissionHealth.hasThumbnail,
    )
    .map((participant) => participant.activeTopicSubmissionId)
    .filter((submissionId): submissionId is number => submissionId !== null)
}
