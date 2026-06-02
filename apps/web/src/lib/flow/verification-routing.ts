export type MarathonVerificationMode = 'all' | 'flagged' | 'none'
export type ValidationDecision = 'pending' | 'passed' | 'flagged' | null | undefined
export type FlaggedVerificationOutcome = 'checking' | 'confirmation' | 'qr'

export const VALIDATION_DECISION_TIMEOUT_MS = 30_000

export function toMarathonVerificationMode(
  value: string | null | undefined,
): MarathonVerificationMode {
  return value === 'flagged' || value === 'none' || value === 'all' ? value : 'all'
}

export function getPostUploadDestination({
  verificationMode,
  serializedParams,
}: {
  verificationMode: MarathonVerificationMode
  serializedParams: string
}) {
  return verificationMode === 'none'
    ? `/live/confirmation${serializedParams}`
    : `/live/verification${serializedParams}`
}

export function getFlaggedVerificationOutcome({
  decision,
  timedOut,
  hasError,
}: {
  decision: ValidationDecision
  timedOut: boolean
  hasError: boolean
}): FlaggedVerificationOutcome {
  if (hasError || timedOut || decision === 'flagged') {
    return 'qr'
  }

  if (decision === 'passed') {
    return 'confirmation'
  }

  return 'checking'
}
