import { describe, expect, it } from '@effect/vitest'
import type { GalleryFeaturedSection } from '@blikka/db'
import {
  finalizedStatusesForVerificationMode,
  formatGalleryTopicName,
  isByCameraTopicPublishable,
  orderedEnabledFeaturedSections,
} from './helpers'

describe('finalizedStatusesForVerificationMode', () => {
  it('includes completed and verified when verification is disabled', () => {
    expect(finalizedStatusesForVerificationMode('none')).toEqual(['completed', 'verified'])
  })

  it('requires verified when verification is enabled', () => {
    expect(finalizedStatusesForVerificationMode('all')).toEqual(['verified'])
    expect(finalizedStatusesForVerificationMode('flagged')).toEqual(['verified'])
  })
})

describe('isByCameraTopicPublishable', () => {
  const now = '2026-06-08T12:00:00.000Z'

  it('is not publishable without a scheduled end', () => {
    expect(isByCameraTopicPublishable({ scheduledEnd: null, nowIso: now })).toBe(false)
  })

  it('is not publishable while the window is still open', () => {
    expect(
      isByCameraTopicPublishable({ scheduledEnd: '2026-06-08T13:00:00.000Z', nowIso: now }),
    ).toBe(false)
  })

  it('is publishable once the window has closed', () => {
    expect(
      isByCameraTopicPublishable({ scheduledEnd: '2026-06-08T11:00:00.000Z', nowIso: now }),
    ).toBe(true)
  })
})

describe('formatGalleryTopicName', () => {
  it('prefixes the 1-based topic order before the name', () => {
    expect(formatGalleryTopicName('Street', 0)).toBe('1. Street')
    expect(formatGalleryTopicName('Portrait', 2)).toBe('3. Portrait')
  })
})

describe('orderedEnabledFeaturedSections', () => {
  const section = (overrides: Partial<GalleryFeaturedSection>): GalleryFeaturedSection => ({
    id: 'a',
    kind: 'topic-winners',
    enabled: true,
    order: 0,
    ...overrides,
  })

  it('keeps only enabled sections and sorts them by order', () => {
    const sections: GalleryFeaturedSection[] = [
      section({ id: 'c', order: 2 }),
      section({ id: 'b', order: 1, enabled: false }),
      section({ id: 'a', order: 0 }),
    ]

    const result = orderedEnabledFeaturedSections(sections)
    expect(result.map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('does not mutate the input array', () => {
    const sections: GalleryFeaturedSection[] = [
      section({ id: 'b', order: 1 }),
      section({ id: 'a', order: 0 }),
    ]
    orderedEnabledFeaturedSections(sections)
    expect(sections.map((s) => s.id)).toEqual(['b', 'a'])
  })
})
