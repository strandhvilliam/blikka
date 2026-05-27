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
export const MAX_IMAGE_FILE_BYTES = 25 * 1024 * 1024

export function getGridSize(photoCount: ContactSheetPhotoCount) {
  return photoCount === 8 ? 3 : 5
}
