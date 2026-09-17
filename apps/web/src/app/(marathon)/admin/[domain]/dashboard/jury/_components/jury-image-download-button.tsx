'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

import { useDomain } from '@/lib/domain-provider'
import { cn } from '@/lib/utils'
import {
  canDownloadJuryImage,
  downloadJuryResultImage,
  type DownloadableJuryParticipant,
} from '../_lib/download-jury-result-image'

/**
 * A small download-icon button for a single jury pick's image. Rendered as a sibling overlay on the
 * result photos (never nested inside their preview button) and inline in the ratings table. It stops
 * propagation so a click downloads without also opening the photo preview. Renders nothing when the
 * pick has no downloadable image.
 */
export function JuryImageDownloadButton({
  participant,
  className,
  label,
}: {
  participant: DownloadableJuryParticipant
  className?: string
  label?: string
}) {
  const domain = useDomain()
  const [downloading, setDownloading] = useState(false)

  if (!canDownloadJuryImage(participant)) {
    return null
  }

  const handleClick = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDownloading(true)
    try {
      await downloadJuryResultImage(domain, participant)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={downloading}
      aria-label={label ?? `Download image for #${participant.reference}`}
      title={label ?? 'Download image'}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-border/60 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 disabled:opacity-60',
        'h-7 w-7',
        className,
      )}
    >
      {downloading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
