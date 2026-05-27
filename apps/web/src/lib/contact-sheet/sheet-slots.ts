import type { ContactSheetPhotoCount } from './constants'

export interface ContactSheetSlot {
  id: string
  file: File | null
  previewUrl: string | null
}

export function createSlotId() {
  return crypto.randomUUID()
}

export function createEmptySlots(photoCount: ContactSheetPhotoCount): ContactSheetSlot[] {
  return Array.from({ length: photoCount }, () => ({
    id: createSlotId(),
    file: null,
    previewUrl: null,
  }))
}

export function getTopicLabelsFromMarathon(
  topics: Array<{ name: string; orderIndex: number }>,
  photoCount: ContactSheetPhotoCount,
) {
  return Array.from({ length: photoCount }, (_, orderIndex) => {
    const topic = topics.find((t) => t.orderIndex === orderIndex)
    return topic?.name ?? ''
  })
}

export function getTopicsForPhotoCount(
  topics: Array<{ name: string; orderIndex: number }>,
  photoCount: ContactSheetPhotoCount,
) {
  return Array.from({ length: photoCount }, (_, orderIndex) => {
    const topic = topics.find((t) => t.orderIndex === orderIndex)
    return {
      orderIndex,
      name: topic?.name ?? '',
    }
  })
}

export function resizeSlots(
  current: ContactSheetSlot[],
  nextPhotoCount: ContactSheetPhotoCount,
): ContactSheetSlot[] {
  if (nextPhotoCount > current.length) {
    const extra = Array.from({ length: nextPhotoCount - current.length }, () => ({
      id: createSlotId(),
      file: null,
      previewUrl: null,
    } satisfies ContactSheetSlot))

    return [...current, ...extra]
  }

  for (const slot of current.slice(nextPhotoCount)) {
    if (slot.previewUrl) {
      URL.revokeObjectURL(slot.previewUrl)
    }
  }

  return current.slice(0, nextPhotoCount)
}

export function revokeSlotPreviewUrls(slots: ContactSheetSlot[]) {
  for (const slot of slots) {
    if (slot.previewUrl) {
      URL.revokeObjectURL(slot.previewUrl)
    }
  }
}
