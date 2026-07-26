import type { FlowVariant } from './flow/constants'

export type ParticipantExistenceStatus =
  | 'prepared'
  | 'initialized'
  | 'completed'
  | 'verified'
  | null

export interface ParticipantExistenceResult {
  exists: boolean
  status: ParticipantExistenceStatus
}

export type StaffLaptopUploadLookupOutcome =
  | { kind: 'manual-entry' }
  | { kind: 'existing'; requiresOverwriteWarning: boolean }
  | { kind: 'blocked'; reason: 'completed' | 'verified' }

export function resolveStaffLaptopUploadLookupOutcome(
  result: ParticipantExistenceResult,
): StaffLaptopUploadLookupOutcome {
  if (!result.exists) {
    return { kind: 'manual-entry' }
  }

  if (result.status === 'completed') {
    return { kind: 'blocked', reason: 'completed' }
  }

  if (result.status === 'verified') {
    return { kind: 'blocked', reason: 'verified' }
  }

  return {
    kind: 'existing',
    requiresOverwriteWarning: result.status === 'initialized',
  }
}

/**
 * Which confirm dialog the live participant-number step shows for an already-taken number.
 *
 * No status is a dead end — a duplicate number always resolves to a dialog the participant
 * can accept. The kinds only differ in how loudly they warn about what gets replaced.
 */
export type ParticipantNumberDialogKind =
  /** Upload flow over a finished (completed/verified) upload — replaces the submitted photos. */
  | 'replace-upload'
  /** Prepare flow over a finished upload — resets the registration of a number that already submitted. */
  | 'replace-prepared-upload'
  /** Prepare flow over an upload in progress — replaces that in-flight upload. */
  | 'replace-in-progress'
  /** Upload flow picking up a registration prepared earlier. */
  | 'continue-prepared'
  /** Prepare flow over an existing registration — only overwrites the saved details. */
  | 'update-registration'
  /** Upload flow resuming an existing session of its own. */
  | 'continue-existing'

export function resolveParticipantNumberDialogKind({
  flowVariant,
  status,
}: {
  flowVariant: FlowVariant
  status: ParticipantExistenceStatus
}): ParticipantNumberDialogKind {
  const isFinalized = status === 'completed' || status === 'verified'

  if (isFinalized) {
    return flowVariant === 'prepare' ? 'replace-prepared-upload' : 'replace-upload'
  }

  if (flowVariant === 'prepare') {
    return status === 'initialized' ? 'replace-in-progress' : 'update-registration'
  }

  return status === 'prepared' ? 'continue-prepared' : 'continue-existing'
}
