import { getCapturedAtDate } from "@/lib/exif-parsing"
import { reassignOrderIndexes } from "@/lib/file-processing"

export interface PhotoWithExifLike {
  exif: Record<string, unknown>
}

export interface PhotoWithOrderIndex {
  orderIndex: number
}

export function hasMissingCapturedAtTimestamp<T extends PhotoWithExifLike>(photos: T[]) {
  return photos.some((photo) => getCapturedAtDate(photo.exif) === null)
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

export function moveItemInArray<T>(items: T[], index: number, direction: "up" | "down") {
  const targetIndex = direction === "up" ? index - 1 : index + 1

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
