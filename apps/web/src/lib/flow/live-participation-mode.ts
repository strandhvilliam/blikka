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
