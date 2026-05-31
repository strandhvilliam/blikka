import { describe, expect, it } from 'vitest'

import { getOriginalViewerSource, getThumbnailDisplaySource } from './submission-image'

describe('submission image source selection', () => {
  it('uses optimized thumbnail when a thumbnail exists', () => {
    expect(
      getThumbnailDisplaySource({
        thumbnailUrl: 'https://example.com/thumb.jpg',
        originalUrl: 'https://example.com/original.jpg',
      }),
    ).toEqual({ kind: 'optimized-thumbnail', src: 'https://example.com/thumb.jpg' })
  })

  it('uses raw original fallback when a thumbnail is missing', () => {
    expect(
      getThumbnailDisplaySource({
        thumbnailUrl: null,
        originalUrl: 'https://example.com/original.jpg',
      }),
    ).toEqual({ kind: 'raw-original-fallback', src: 'https://example.com/original.jpg' })
  })

  it('returns missing for thumbnail slots without any source', () => {
    expect(getThumbnailDisplaySource({ thumbnailUrl: null, originalUrl: null })).toEqual({
      kind: 'missing',
    })
  })

  it('uses optimized original for full viewers when an original exists', () => {
    expect(
      getOriginalViewerSource({
        thumbnailUrl: 'https://example.com/thumb.jpg',
        originalUrl: 'https://example.com/original.jpg',
      }),
    ).toEqual({ kind: 'optimized-original', src: 'https://example.com/original.jpg' })
  })

  it('uses optimized thumbnail fallback for full viewers without an original', () => {
    expect(
      getOriginalViewerSource({
        thumbnailUrl: 'https://example.com/thumb.jpg',
        originalUrl: null,
      }),
    ).toEqual({ kind: 'optimized-thumbnail-fallback', src: 'https://example.com/thumb.jpg' })
  })

  it('returns missing for full viewers without any source', () => {
    expect(getOriginalViewerSource({ thumbnailUrl: null, originalUrl: null })).toEqual({
      kind: 'missing',
    })
  })
})
