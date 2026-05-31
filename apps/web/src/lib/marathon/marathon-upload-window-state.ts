import type { Marathon } from '@blikka/db'

export type MarathonUploadWindowState = 'not-configured' | 'scheduled' | 'open' | 'closed'

type MarathonTiming = Pick<Marathon, 'setupCompleted' | 'startDate' | 'endDate'>

export function getMarathonUploadWindowState(
  marathon: MarathonTiming,
  now = new Date(),
): MarathonUploadWindowState {
  if (!marathon.setupCompleted) {
    return 'not-configured'
  }

  if (!marathon.startDate || !marathon.endDate) {
    return 'not-configured'
  }

  const startDate = new Date(marathon.startDate)
  const endDate = new Date(marathon.endDate)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 'not-configured'
  }

  if (now < startDate) {
    return 'scheduled'
  }

  if (now > endDate) {
    return 'closed'
  }

  return 'open'
}
