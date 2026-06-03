import { describe, expect, it } from 'vitest'

import {
  canReorderPhotos,
  hasMissingCapturedAtTimestamp,
  isPhotoReorderModeActive,
  moveItemInArray,
  movePhotoAtDisplayIndex,
  orderPhotosForTopicSlots,
  reassignPhotosToTopicOrder,
  shouldAutoSortPhotosByCaptureTime,
  sortPhotosByOrderIndex,
} from './photo-ordering'

describe('photo-ordering', () => {
  it('detects when one or more photos are missing a usable capture timestamp', () => {
    expect(
      hasMissingCapturedAtTimestamp([
        { exif: { DateTimeOriginal: '2024-01-01T10:00:00.000Z' } },
        { exif: { DateTimeDigitized: '2024-01-01T10:05:00.000Z' } },
      ]),
    ).toBe(false)

    expect(
      hasMissingCapturedAtTimestamp([
        { exif: { DateTimeOriginal: '2024-01-01T10:00:00.000Z' } },
        { exif: {} },
      ]),
    ).toBe(true)
  })

  it('activates reorder mode for missing capture times and future organizer override', () => {
    const photos = [{ exif: {} }]

    expect(isPhotoReorderModeActive(photos)).toBe(true)
    expect(isPhotoReorderModeActive([{ exif: { DateTimeOriginal: '2024-01-01T10:00:00.000Z' } }])).toBe(
      false,
    )
    expect(isPhotoReorderModeActive(photos, { organizerAllowsManualReorder: true })).toBe(true)
    expect(
      isPhotoReorderModeActive([{ exif: { DateTimeOriginal: '2024-01-01T10:00:00.000Z' } }], {
        organizerAllowsManualReorder: true,
      }),
    ).toBe(true)
  })

  it('only auto-sorts while reorder mode is inactive', () => {
    expect(
      shouldAutoSortPhotosByCaptureTime([{ exif: { DateTimeOriginal: '2024-01-01T10:00:00.000Z' } }]),
    ).toBe(true)
    expect(shouldAutoSortPhotosByCaptureTime([{ exif: {} }])).toBe(false)
  })

  it('requires at least two photos before inline reorder controls are shown', () => {
    expect(canReorderPhotos([{ exif: {} }])).toBe(false)
    expect(
      canReorderPhotos([{ exif: {} }, { exif: { DateTimeOriginal: '2024-01-01T10:00:00.000Z' } }]),
    ).toBe(true)
  })

  it('reassigns accepted row order onto the topic order indexes', () => {
    const reordered = reassignPhotosToTopicOrder(
      [
        { id: 'b', orderIndex: 9 },
        { id: 'a', orderIndex: 3 },
        { id: 'c', orderIndex: 12 },
      ],
      [4, 8, 12],
    )

    expect(reordered).toEqual([
      { id: 'b', orderIndex: 4 },
      { id: 'a', orderIndex: 8 },
      { id: 'c', orderIndex: 12 },
    ])
  })

  it('moves items up and down while keeping boundaries stable', () => {
    expect(moveItemInArray(['a', 'b', 'c'], 1, 'up')).toEqual(['b', 'a', 'c'])
    expect(moveItemInArray(['a', 'b', 'c'], 1, 'down')).toEqual(['a', 'c', 'b'])

    const original = ['a', 'b', 'c']

    expect(moveItemInArray(original, 0, 'up')).toBe(original)
    expect(moveItemInArray(original, 2, 'down')).toBe(original)
  })

  it('does not mutate the original array when calculating a move', () => {
    const original = ['a', 'b', 'c']

    const moved = moveItemInArray(original, 2, 'up')

    expect(moved).toEqual(['a', 'c', 'b'])
    expect(original).toEqual(['a', 'b', 'c'])
  })

  it('moves photos by display index and reassigns topic order indexes', () => {
    const moved = movePhotoAtDisplayIndex(
      [
        { id: 'a', orderIndex: 0 },
        { id: 'b', orderIndex: 1 },
        { id: 'c', orderIndex: 2 },
      ],
      2,
      'up',
      [10, 20, 30],
    )

    expect(moved).toEqual([
      { id: 'a', orderIndex: 10 },
      { id: 'c', orderIndex: 20 },
      { id: 'b', orderIndex: 30 },
    ])
  })

  it('re-sorts by capture time when reorder mode turns off after removing a photo without timestamp', () => {
    const ordered = orderPhotosForTopicSlots(
      [
        { id: 'manual-late', orderIndex: 0, exif: { DateTimeOriginal: '2024-03-01T18:00:00.000Z' } },
        { id: 'manual-early', orderIndex: 1, exif: { DateTimeOriginal: '2024-03-01T08:00:00.000Z' } },
      ],
      [10, 20],
    )

    expect(ordered.map((photo) => photo.id)).toEqual(['manual-early', 'manual-late'])
    expect(ordered.map((photo) => photo.orderIndex)).toEqual([10, 20])
  })

  it('preserves manual order while reorder mode is still active', () => {
    const ordered = orderPhotosForTopicSlots(
      [
        { id: 'manual-late', orderIndex: 0, exif: { DateTimeOriginal: '2024-03-01T18:00:00.000Z' } },
        { id: 'no-time', orderIndex: 1, exif: {} },
      ],
      [10, 20],
    )

    expect(ordered.map((photo) => photo.id)).toEqual(['manual-late', 'no-time'])
  })

  it('sorts photos by order index for stable display', () => {
    expect(
      sortPhotosByOrderIndex([
        { id: 'b', orderIndex: 2 },
        { id: 'a', orderIndex: 0 },
      ]).map((photo) => photo.id),
    ).toEqual(['a', 'b'])
  })
})
