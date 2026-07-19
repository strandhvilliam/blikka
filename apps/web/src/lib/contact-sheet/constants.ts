import {
  ABUSE_MAX_OBJECT_BYTES,
  MAX_NON_JPEG_IMAGE_FILE_BYTES,
} from '@blikka/image-manipulation/constants'
import type { SponsorPosition } from '@blikka/image-manipulation'

export const CONTACT_SHEET_PHOTO_COUNTS = [8, 24] as const
export type ContactSheetPhotoCount = (typeof CONTACT_SHEET_PHOTO_COUNTS)[number]

export const CONTACT_SHEET_FORMATS = {
  classic: { label: 'Classic', width: 3986, height: 2657 },
  a3: { label: 'A3', width: 4961, height: 3508 },
} as const

export type ContactSheetFormatKey = keyof typeof CONTACT_SHEET_FORMATS

export const SPONSOR_POSITIONS: { value: SponsorPosition; label: string }[] = [
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
  { value: 'center', label: 'Center' },
]

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** @deprecated Prefer getMaxImageFileBytesForType — JPEG uses a higher ceiling. */
export const MAX_IMAGE_FILE_BYTES = MAX_NON_JPEG_IMAGE_FILE_BYTES

export function getMaxImageFileBytesForType(mimeType: string): number {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return ABUSE_MAX_OBJECT_BYTES
  }
  return MAX_NON_JPEG_IMAGE_FILE_BYTES
}

export function formatMaxImageFileBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

export function getGridSize(photoCount: ContactSheetPhotoCount) {
  return photoCount === 8 ? 3 : 5
}
