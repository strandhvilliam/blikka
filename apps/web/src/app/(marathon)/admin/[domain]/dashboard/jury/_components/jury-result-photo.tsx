'use client'

import {
  getThumbnailDisplaySource,
  SubmissionRawOriginalImage,
  SubmissionThumbnailImage,
} from '@/components/submission-image'
import {
  getJuryResultFullUrl,
  getJuryResultThumbnailUrl,
  type JuryResultParticipantAssets,
} from '@/lib/jury/jury-utils'
import { cn } from '@/lib/utils'

/** A participant as the admin result views need them: identity plus the image the juror judged. */
export interface JuryResultParticipant extends JuryResultParticipantAssets {
  id: number
  reference: string
  firstname: string
  lastname: string
}

export function getJuryParticipantDisplayName(participant: JuryResultParticipant) {
  const name = `${participant.firstname} ${participant.lastname}`.trim()
  return name || `#${participant.reference}`
}

/**
 * Contact sheets have no thumbnail rendition, so the source falls back to the raw asset rather than
 * rendering nothing — a class invite would otherwise show an empty frame for every pick.
 */
export function JuryResultPhoto({
  participant,
  className,
  priority = false,
}: {
  participant: JuryResultParticipant
  className?: string
  priority?: boolean
}) {
  const source = getThumbnailDisplaySource({
    thumbnailUrl: getJuryResultThumbnailUrl(participant),
    originalUrl: getJuryResultFullUrl(participant),
  })
  const alt = `Entry by ${getJuryParticipantDisplayName(participant)}`

  if (source.kind === 'optimized-thumbnail') {
    return (
      <SubmissionThumbnailImage src={source.src} alt={alt} className={className} priority={priority} />
    )
  }

  if (source.kind === 'raw-original-fallback') {
    return (
      <SubmissionRawOriginalImage
        src={source.src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex size-full items-center justify-center bg-muted/40 text-[11px] text-muted-foreground',
        className,
      )}
    >
      No preview
    </div>
  )
}
