import type { SponsorPosition } from '@blikka/image-manipulation'
import type { ContactSheetFormatKey, ContactSheetPhotoCount } from '@/lib/contact-sheet/constants'

export interface CustomContactSheetConfigInput {
  reference: string
  format: ContactSheetFormatKey
  sponsorPosition: SponsorPosition
  includeSponsor: boolean
  photoCount: ContactSheetPhotoCount
  topics: Array<{ name: string; orderIndex: number }>
}

const SPONSOR_POSITIONS = [
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
  'center',
] as const satisfies readonly SponsorPosition[]

export function parseCustomContactSheetConfig(
  raw: string,
): { ok: true; config: CustomContactSheetConfigInput } | { ok: false; message: string } {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, message: 'Invalid config JSON' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: 'Invalid config payload' }
  }

  const value = parsed as Record<string, unknown>

  if (typeof value.reference !== 'string' || !value.reference.trim()) {
    return { ok: false, message: 'Reference is required' }
  }

  if (value.format !== 'classic' && value.format !== 'a3') {
    return { ok: false, message: 'Invalid format' }
  }

  if (!SPONSOR_POSITIONS.includes(value.sponsorPosition as SponsorPosition)) {
    return { ok: false, message: 'Invalid sponsor position' }
  }

  if (typeof value.includeSponsor !== 'boolean') {
    return { ok: false, message: 'Invalid includeSponsor value' }
  }

  if (value.photoCount !== 8 && value.photoCount !== 24) {
    return { ok: false, message: 'Photo count must be 8 or 24' }
  }

  if (!Array.isArray(value.topics)) {
    return { ok: false, message: 'Topics must be an array' }
  }

  const topics: CustomContactSheetConfigInput['topics'] = []

  for (const topic of value.topics) {
    if (!topic || typeof topic !== 'object') {
      return { ok: false, message: 'Invalid topic entry' }
    }

    const topicValue = topic as Record<string, unknown>
    if (typeof topicValue.name !== 'string' || !topicValue.name.trim()) {
      return { ok: false, message: 'Each topic must have a name' }
    }

    if (typeof topicValue.orderIndex !== 'number' || !Number.isInteger(topicValue.orderIndex)) {
      return { ok: false, message: 'Each topic must have an orderIndex' }
    }

    topics.push({
      name: topicValue.name.trim(),
      orderIndex: topicValue.orderIndex,
    })
  }

  return {
    ok: true,
    config: {
      reference: value.reference.trim(),
      format: value.format,
      sponsorPosition: value.sponsorPosition as SponsorPosition,
      includeSponsor: value.includeSponsor,
      photoCount: value.photoCount,
      topics,
    },
  }
}
