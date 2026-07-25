import type { FlowVariant } from './constants'

/** Query param used to deep-link into a marathon upload choice. */
export const LIVE_PARTICIPATION_MODE_QUERY_PARAM = 'mode'

export const LIVE_PARTICIPATION_MODES = ['upload', 'prepare'] as const satisfies ReadonlyArray<FlowVariant>

export type LiveParticipationMode = (typeof LIVE_PARTICIPATION_MODES)[number]

export function parseLiveParticipationMode(
  value: string | null | undefined,
): LiveParticipationMode | null {
  if (value === 'upload' || value === 'prepare') {
    return value
  }

  return null
}

/** Append or remove `?mode=` on a live upload URL. Pass `null` for no preselection. */
export function withLiveParticipationMode(
  url: string,
  mode: LiveParticipationMode | null,
): string {
  const parsed = new URL(url, 'http://local.invalid')
  if (mode == null) {
    parsed.searchParams.delete(LIVE_PARTICIPATION_MODE_QUERY_PARAM)
  } else {
    parsed.searchParams.set(LIVE_PARTICIPATION_MODE_QUERY_PARAM, mode)
  }

  // Preserve relative inputs (no origin) when a base was only used for parsing.
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  }

  return parsed.toString()
}
