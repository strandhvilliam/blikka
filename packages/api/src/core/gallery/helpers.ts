import type { GalleryFeaturedSection, Marathon } from '@blikka/db'

/**
 * Participant statuses considered "finalized" for public display.
 * By-camera submissions do not use the marathon verification flow, so completed uploads
 * are public once the topic gallery itself is published.
 * When verification is required (`all`/`flagged`) only `verified` participants are shown;
 * when verification is not required (`none`) `completed` participants are also shown.
 */
export function finalizedStatusesForGalleryMode(
  mode: Marathon['mode'],
  verificationMode: Marathon['verificationMode'],
): readonly string[] {
  return mode === 'by-camera' || verificationMode === 'none'
    ? ['completed', 'verified']
    : ['verified']
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

/** Public gallery topic label, e.g. `1. Street` for orderIndex 0. */
export function formatGalleryTopicName(name: string, orderIndex: number): string {
  return `${orderIndex + 1}. ${name}`
}
