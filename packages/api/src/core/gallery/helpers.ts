import type { GalleryFeaturedSection, Marathon } from '@blikka/db'

/**
 * Participant statuses considered "finalized" for public display.
 * When verification is required (`all`/`flagged`) only `verified` participants are shown;
 * when verification is not required (`none`) `completed` participants are also shown.
 */
export function finalizedStatusesForVerificationMode(
  verificationMode: Marathon['verificationMode'],
): readonly string[] {
  return verificationMode === 'none' ? ['completed', 'verified'] : ['verified']
}

/**
 * A by-camera topic gallery may be published only once its submission window is closed,
 * i.e. it has a `scheduledEnd` in the past. An unscheduled or still-open window is not publishable.
 */
export function isByCameraTopicPublishable({
  scheduledEnd,
  nowIso,
}: {
  scheduledEnd: string | null
  nowIso: string
}): boolean {
  if (!scheduledEnd) {
    return false
  }
  return new Date(scheduledEnd).getTime() <= new Date(nowIso).getTime()
}

/** Enabled featured sections in their configured order. */
export function orderedEnabledFeaturedSections(
  sections: readonly GalleryFeaturedSection[],
): GalleryFeaturedSection[] {
  return sections.filter((section) => section.enabled).toSorted((a, b) => a.order - b.order)
}
