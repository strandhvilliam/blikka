/**
 * Wire format for the QR code a participant shows to staff for verification.
 *
 * Encoded as `<domain>-<participantId>-<reference>`. The domain is a marathon
 * subdomain label and may itself contain `-`, so the payload is parsed from the right:
 * the last segment is the reference, the one before it the participant id, and
 * everything remaining is the domain. Splitting left-to-right instead makes every scan
 * for a hyphenated domain fail the domain check.
 *
 * Build and parse live together so the two sides cannot drift.
 */

const SEPARATOR = '-'

export interface ParticipantQrPayload {
  domain: string
  participantId: string
  reference: string
}

export function buildParticipantQrValue({
  domain,
  participantId,
  reference,
}: {
  domain: string
  participantId?: number | string | null
  reference: string
}): string {
  return [domain, participantId ?? '', reference].join(SEPARATOR)
}

export function parseParticipantQrValue(value: string | null): ParticipantQrPayload | null {
  if (!value) return null

  const segments = value.trim().split(SEPARATOR)

  // domain + participantId + reference, where domain may span several segments.
  if (segments.length < 3) return null

  const reference = segments[segments.length - 1] ?? ''
  const participantId = segments[segments.length - 2] ?? ''
  const domain = segments.slice(0, -2).join(SEPARATOR)

  if (!domain || !reference) return null

  return { domain, participantId, reference }
}
