import { getCapturedAtDate } from '@/lib/exif-parsing'
import { reassignOrderIndexes, sortByExifDate } from '@/lib/file-processing'

export interface PhotoWithExifLike {
  exif: Record<string, unknown>
}

export interface PhotoWithOrderIndex {
  orderIndex: number
}

export interface PhotoReorderSettings {
  /** Reserved for organizer-controlled manual reorder (not wired yet). */
  organizerAllowsManualReorder?: boolean
}

export function hasMissingCapturedAtTimestamp<T extends PhotoWithExifLike>(photos: T[]) {
  return photos.some((photo) => getCapturedAtDate(photo.exif) === null)
}

export function isPhotoReorderModeActive<T extends PhotoWithExifLike>(
  photos: T[],
  settings: PhotoReorderSettings = {},
): boolean {
  if (settings.organizerAllowsManualReorder) {
    return true
  }

  return hasMissingCapturedAtTimestamp(photos)
}

export function canReorderPhotos<T extends PhotoWithExifLike>(
  photos: T[],
  settings: PhotoReorderSettings = {},
): boolean {
  return photos.length > 1 && isPhotoReorderModeActive(photos, settings)
}

export function shouldAutoSortPhotosByCaptureTime<T extends PhotoWithExifLike>(
  photos: T[],
  settings: PhotoReorderSettings = {},
): boolean {
  return !isPhotoReorderModeActive(photos, settings)
}

export function sortPhotosByOrderIndex<T extends PhotoWithOrderIndex>(photos: T[]): T[] {
  return [...photos].sort((a, b) => a.orderIndex - b.orderIndex)
}

export function reassignPhotosToTopicOrder<T extends PhotoWithOrderIndex>(
  photos: T[],
  topicOrderIndexes: number[],
) {
  return reassignOrderIndexes(photos, topicOrderIndexes, (photo, orderIndex) => ({
    ...photo,
    orderIndex,
  }))
}

/** Sort by capture time when allowed, then map each slot to its topic orderIndex. */
export function orderPhotosForTopicSlots<T extends PhotoWithExifLike & PhotoWithOrderIndex>(
  photos: T[],
  topicOrderIndexes: number[],
  settings: PhotoReorderSettings = {},
): T[] {
  const orderedPhotos = shouldAutoSortPhotosByCaptureTime(photos, settings)
    ? sortByExifDate(photos, (photo) => photo.exif)
    : photos

  return reassignPhotosToTopicOrder(orderedPhotos, topicOrderIndexes)
}

export function moveItemInArray<T>(items: T[], index: number, direction: 'up' | 'down') {
  const targetIndex = direction === 'up' ? index - 1 : index + 1

  if (index < 0 || index >= items.length || targetIndex < 0 || targetIndex >= items.length) {
    return items
  }

  const nextItems = [...items]
  const [item] = nextItems.splice(index, 1)

  if (item === undefined) {
    return items
  }

  nextItems.splice(targetIndex, 0, item)
  return nextItems
}

export function movePhotoAtDisplayIndex<T extends PhotoWithOrderIndex>(
  photos: T[],
  displayIndex: number,
  direction: 'up' | 'down',
  topicOrderIndexes: number[],
): T[] {
  const sorted = sortPhotosByOrderIndex(photos)
  const moved = moveItemInArray(sorted, displayIndex, direction)
  return reassignPhotosToTopicOrder(moved, topicOrderIndexes)
}
