import { timingSafeEqual } from 'node:crypto'
import { normalizeEmail } from '../voting/helpers'

export { normalizeEmail }

export function constantTimeTokenEquals(presented: string, stored: string): boolean {
  if (presented.length !== stored.length || presented.length === 0) {
    return false
  }

  return timingSafeEqual(Buffer.from(presented), Buffer.from(stored))
}

export function computeJuryJwtExpSeconds(
  expiresAt: string,
  iat: number,
  maxExpiryDays: number,
): number {
  const invitationExp = Math.floor(new Date(expiresAt).getTime() / 1000)
  const maxExp = iat + maxExpiryDays * 24 * 60 * 60
  return Math.min(invitationExp, maxExp)
}

export function buildJuryInviteUrl({ domain, token }: { domain: string; token: string }) {
  return `https://${domain}.blikka.app/live/jury/${token}`
}

export function formatJuryScopeLabel({
  inviteType,
  topicName,
  competitionClassName,
  deviceGroupName,
}: {
  inviteType: 'topic' | 'class'
  topicName?: string | null
  competitionClassName?: string | null
  deviceGroupName?: string | null
}) {
  if (inviteType === 'topic') {
    return topicName ? `topic "${topicName}"` : 'the assigned topic'
  }

  const classLabel = competitionClassName ?? 'the assigned class'
  return deviceGroupName ? `${classLabel} (${deviceGroupName})` : classLabel
}

export function formatJuryExpiryLabel(expiresAt: string) {
  return new Date(expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
