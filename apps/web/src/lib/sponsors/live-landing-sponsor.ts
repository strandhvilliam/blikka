/** Latest row per type; used for sponsor list queries that may include re-upload history */
function latestOfType<T extends { type: string; createdAt: string }>(
  sponsors: T[],
  type: string,
): T | undefined {
  return sponsors
    .filter((s) => s.type === type)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .at(-1)
}

/** Preference order: canonical slot first, then legacy multi-slot types. */
const LANDING_TYPE_PRIORITY = [
  "live-landing",
  "live-initial-1",
  "live-initial-2",
  "live-initial-3",
  "live-initial-4",
] as const

/**
 * Single image for the live app landing page. New uploads use `live-landing`;
 * older marathons may still have `live-initial-*` rows — first match wins.
 */
export function resolveLiveLandingSponsor<T extends { type: string; createdAt: string }>(
  sponsors: T[] | undefined,
): T | undefined {
  if (!sponsors?.length) return undefined
  for (const type of LANDING_TYPE_PRIORITY) {
    const row = latestOfType(sponsors, type)
    if (row) return row
  }
  return undefined
}
