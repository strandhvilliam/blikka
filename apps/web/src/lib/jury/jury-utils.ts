import { formatDomainLink, formatDomainPathname, buildS3Url } from '@/lib/utils'

import type { JuryInvitation, JuryListParticipant, JuryShortlistPick } from './jury-types'

export function getJuryEntryPath(domain: string, token: string) {
  return formatDomainPathname(`/live/jury/${token}`, domain, 'live')
}

export function getJuryEntryLink(domain: string, token: string) {
  return formatDomainLink(`/live/jury/${token}`, domain, 'live')
}

export function getDisplayInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()

  const first = parts[0]!
  const last = parts[parts.length - 1]!
  return `${first[0]}${last[0]}`.toUpperCase()
}

export function getJuryViewerPath(domain: string, token: string) {
  return formatDomainPathname(`/live/jury/${token}/viewer`, domain, 'live')
}

export function getJuryCompletedPath(domain: string, token: string) {
  return formatDomainPathname(`/live/jury/${token}/completed`, domain, 'live')
}

export function getJuryUnavailablePath(
  domain: string,
  token: string,
  reason: 'expired' | 'unsupported-mode' | 'inactive' | 'revoked',
) {
  return formatDomainPathname(`/live/jury/${token}/unavailable?reason=${reason}`, domain, 'live')
}

/** Cursor pagination for `getJurySubmissionsFromToken` — shared by server prefetch and client hook. */
export function getJurySubmissionsNextPageParam(
  lastPage:
    | {
        nextCursor?: string | null
      }
    | null
    | undefined,
) {
  return lastPage?.nextCursor ?? undefined
}

/** Shortlist / winner chips — aligned with `JurySidebar` pick actions */

export const juryPickChipBase =
  'inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

const interactive = 'cursor-pointer'

/** Pick is on the shortlist / holds the win */
export const juryPickChipActive = `${juryPickChipBase} ${interactive} border-brand-primary bg-brand-primary text-white shadow-[0_4px_16px_rgba(254,77,58,0.22)] hover:brightness-[1.03]`

/** Pick can be added */
export const juryPickChipIdle = `${juryPickChipBase} ${interactive} border-border/60 bg-neutral-50 text-brand-black hover:border-brand-primary/40 hover:bg-neutral-100 hover:shadow-md`

/** List card: compact chip next to participant id */
export const juryPickChipCardBadge =
  'inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/60 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-brand-black shadow-sm'

const THUMBNAILS_BUCKET = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
const SUBMISSIONS_BUCKET = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME
const CONTACT_SHEETS_BUCKET = process.env.NEXT_PUBLIC_CONTACT_SHEETS_BUCKET_NAME

export function getParticipantPreview(participant: JuryListParticipant) {
  if (participant.contactSheetKey) {
    return buildS3Url(CONTACT_SHEETS_BUCKET, participant.contactSheetKey)
  }

  if (participant.submission?.thumbnailKey) {
    return buildS3Url(THUMBNAILS_BUCKET, participant.submission.thumbnailKey)
  }

  return undefined
}

export function getParticipantAssetUrl(
  participant: JuryListParticipant | null | undefined,
  invitation: JuryInvitation,
) {
  if (!participant) return undefined

  if (invitation.inviteType === 'class') {
    return buildS3Url(CONTACT_SHEETS_BUCKET, participant.contactSheetKey)
  }

  return buildS3Url(SUBMISSIONS_BUCKET, participant.submission?.key)
}

/**
 * Admin review results carry the image keys on the participant row itself, unlike the juror-side
 * participant shape, so they resolve through their own pair of helpers.
 */
export interface JuryResultParticipantAssets {
  submissionKey: string | null
  submissionThumbnailKey: string | null
  contactSheetKey: string | null
}

/** Small preview of what the juror judged. Contact sheets have no separate thumbnail rendition. */
export function getJuryResultThumbnailUrl(participant: JuryResultParticipantAssets) {
  if (participant.contactSheetKey) {
    return buildS3Url(CONTACT_SHEETS_BUCKET, participant.contactSheetKey)
  }

  return buildS3Url(THUMBNAILS_BUCKET, participant.submissionThumbnailKey)
}

/** Full-size asset for the fullscreen viewer. */
export function getJuryResultFullUrl(participant: JuryResultParticipantAssets) {
  if (participant.contactSheetKey) {
    return buildS3Url(CONTACT_SHEETS_BUCKET, participant.contactSheetKey)
  }

  return buildS3Url(SUBMISSIONS_BUCKET, participant.submissionKey)
}

export function getShortlistedParticipantIds(
  picks: ReadonlyArray<{ participantId: number }>,
): Set<number> {
  return new Set(picks.map((pick) => pick.participantId))
}

/**
 * The shortlist carries no ranking, so display it by participant reference rather than by the order
 * the juror happened to pick in — an incidental order reads as a ranking.
 */
export function sortShortlistForDisplay(
  picks: ReadonlyArray<JuryShortlistPick>,
): JuryShortlistPick[] {
  return picks.toSorted((left, right) => compareParticipantReferences(left, right))
}

export function compareParticipantReferences(
  left: { reference: string },
  right: { reference: string },
): number {
  return left.reference.localeCompare(right.reference, undefined, { numeric: true })
}
