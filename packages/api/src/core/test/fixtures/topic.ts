import type { Topic } from '@blikka/db'

export function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    marathonId: 1,
    name: 'Topic 1',
    visibility: 'public',
    orderIndex: 0,
    scheduledStart: null,
    scheduledEnd: null,
    activatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Topic
}
