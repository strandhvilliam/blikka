import { formatDomainPathname, buildS3Url } from "@/lib/utils"

import type {
  JuryInvitation,
  JuryListParticipant,
  JuryRatingEntry,
} from "./jury-types"

export function getJuryEntryPath(domain: string, token: string) {
  return formatDomainPathname(`/live/jury/${token}`, domain, "live")
}

export function getJuryViewerPath(domain: string, token: string) {
  return formatDomainPathname(`/live/jury/${token}/viewer`, domain, "live")
}

export function getJuryCompletedPath(domain: string, token: string) {
  return formatDomainPathname(`/live/jury/${token}/completed`, domain, "live")
}

export function getJuryUnavailablePath(
  domain: string,
  token: string,
  reason: "expired" | "unsupported-mode" | "inactive",
) {
  return formatDomainPathname(`/live/jury/${token}/unavailable?reason=${reason}`, domain, "live")
}

/** Cursor pagination for `getJurySubmissionsFromToken` — shared by server prefetch and client hook. */
export function getJurySubmissionsNextPageParam(lastPage: {
  nextCursor?: string | null
} | null | undefined) {
  return lastPage?.nextCursor ?? undefined
}

/** Rank chips — aligned with `JurySubmissionViewer` toolbar picks */

export const juryRankChipBase =
  "inline-flex min-h-10 min-w-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 active:scale-[0.98]"

const interactive = "cursor-pointer"

export const juryRankChipActive = `${juryRankChipBase} ${interactive} border-brand-primary bg-brand-primary text-white shadow-[0_4px_16px_rgba(254,77,58,0.22)] hover:brightness-[1.03]`

/** Assigned rank, another participant or “other holder” in detail view */
export const juryRankChipNeutralOccupied = `${juryRankChipBase} ${interactive} border-border/60 bg-neutral-50 text-brand-black hover:border-brand-primary/35 hover:bg-white hover:shadow-md`

/** Empty slot in detail view */
export const juryRankChipNeutralSlot = `${juryRankChipBase} ${interactive} border-border/60 bg-neutral-50 text-brand-black hover:border-brand-primary/40 hover:bg-neutral-100 hover:shadow-md`

/** Top picks row: unassigned slot (non-interactive) */
export const juryRankChipNeutralPlaceholder = `${juryRankChipBase} border-border/60 bg-neutral-50 text-brand-black`

/** List card: compact chip next to participant id */
export const juryRankChipCardBadge =
  "inline-flex min-h-8 min-w-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/60 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-brand-black shadow-sm"

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

  if (invitation.inviteType === "class") {
    return buildS3Url(CONTACT_SHEETS_BUCKET, participant.contactSheetKey)
  }

  return (
    buildS3Url(SUBMISSIONS_BUCKET, participant.submission?.previewKey) ??
    buildS3Url(SUBMISSIONS_BUCKET, participant.submission?.key)
  )
}

export function getAssignedFinalRankingCount(
  ratings: ReadonlyArray<JuryRatingEntry>,
): number {
  return new Set(
    ratings
      .map((rating) => rating.finalRanking)
      .filter(
        (finalRanking): finalRanking is 1 | 2 | 3 =>
          finalRanking === 1 || finalRanking === 2 || finalRanking === 3,
      ),
  ).size
}

export function hasCompleteFinalRankings(
  ratings: ReadonlyArray<JuryRatingEntry>,
): boolean {
  return getAssignedFinalRankingCount(ratings) === 3
}

export function getParticipantFinalRanking(
  ratings: ReadonlyArray<JuryRatingEntry>,
  participantId: number,
): 1 | 2 | 3 | null {
  const entry = ratings.find((rating) => rating.participantId === participantId)
  const finalRanking = entry?.finalRanking

  return finalRanking === 1 || finalRanking === 2 || finalRanking === 3
    ? finalRanking
    : null
}

export function getFinalRankingLabel(finalRanking: 1 | 2 | 3): string {
  switch (finalRanking) {
    case 1:
      return "1st"
    case 2:
      return "2nd"
    case 3:
      return "3rd"
  }
}

export function getRankAssignments(
  ratings: ReadonlyArray<JuryRatingEntry>,
): Map<1 | 2 | 3, number> {
  const assignments = new Map<1 | 2 | 3, number>()
  for (const rating of ratings) {
    if (
      rating.finalRanking === 1 ||
      rating.finalRanking === 2 ||
      rating.finalRanking === 3
    ) {
      assignments.set(rating.finalRanking, rating.participantId)
    }
  }
  return assignments
}
