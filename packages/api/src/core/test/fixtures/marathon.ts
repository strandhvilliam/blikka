import type { Marathon, Topic } from '@blikka/db'

import { makeTopic } from './topic'

export function makeMarathon(
  overrides: Partial<Marathon & { topics?: readonly Topic[] }> = {},
): Marathon & { topics: Topic[] } {
  return {
    id: 1,
    domain: 'demo',
    mode: 'marathon',
    setupCompleted: true,
    startDate: '2026-05-21T10:00:00.000Z',
    endDate: '2026-05-21T18:00:00.000Z',
    contactSheetFormat: 'classic',
    verificationMode: 'all',
    topics: [makeTopic()],
    ...overrides,
  } as Marathon & { topics: Topic[] }
}
