export interface ConfirmationData {
  id: string
  thumbnailUrl?: string
  previewUrl?: string
  name: string
  orderIndex: number
  exif: Record<string, unknown>
}
