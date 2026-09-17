'use client'

import { toast } from 'sonner'

import type { JuryResultParticipantAssets } from '@/lib/jury/jury-utils'

export interface DownloadableJuryParticipant extends JuryResultParticipantAssets {
  reference: string
  firstname: string
  lastname: string
}

/**
 * The image that goes to disk for a single pick — the same choice the folder export makes: a class
 * invite's contact sheet, otherwise the original submission. Thumbnails are for display only, never a
 * download. Returns `null` when the pick has no image on record.
 */
function resolveImage(
  participant: JuryResultParticipantAssets,
): { bucket: 'submissions' | 'contact-sheets'; key: string } | null {
  if (participant.contactSheetKey) {
    return { bucket: 'contact-sheets', key: participant.contactSheetKey }
  }
  if (participant.submissionKey) {
    return { bucket: 'submissions', key: participant.submissionKey }
  }
  return null
}

export function canDownloadJuryImage(participant: JuryResultParticipantAssets): boolean {
  return resolveImage(participant) !== null
}

function fileExtension(key: string): string {
  const match = /\.[a-z0-9]+$/i.exec(key)
  return match ? match[0].toLowerCase() : '.jpg'
}

function nameSlug(participant: { firstname: string; lastname: string }): string {
  return `${participant.firstname} ${participant.lastname}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
}

/**
 * Downloads one pick's image via the same-origin export proxy (S3 GET is not reliably CORS-enabled, so
 * a direct fetch of the public URL cannot be read into a blob). The filename mirrors the folder export
 * so a one-off download sits next to a full one.
 */
export async function downloadJuryResultImage(
  domain: string,
  participant: DownloadableJuryParticipant,
): Promise<void> {
  const image = resolveImage(participant)
  if (!image) {
    toast.error('No image on record for this entry')
    return
  }

  const url = `/api/${domain}/export/jury_result_image?bucket=${image.bucket}&key=${encodeURIComponent(
    image.key,
  )}`
  const filename =
    [
      participant.reference.padStart(4, '0'),
      nameSlug(participant),
      image.bucket === 'contact-sheets' ? 'contact-sheet' : '',
    ]
      .filter(Boolean)
      .join('-') + fileExtension(image.key)

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`)
    }
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    toast.error('Could not download image', {
      description: error instanceof Error ? error.message : undefined,
    })
  }
}
