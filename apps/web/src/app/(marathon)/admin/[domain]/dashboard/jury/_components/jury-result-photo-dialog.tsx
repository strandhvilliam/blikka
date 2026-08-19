'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SubmissionOptimizedOriginalImage } from '@/components/submission-image'
import { getJuryResultFullUrl } from '@/lib/jury/jury-utils'
import { getJuryParticipantDisplayName, type JuryResultParticipant } from './jury-result-photo'

/** Full-size view of a shortlisted entry, opened from the winner card or a shortlist thumbnail. */
export function JuryResultPhotoDialog({
  participant,
  onOpenChange,
}: {
  participant: JuryResultParticipant | null
  onOpenChange: (open: boolean) => void
}) {
  const imageUrl = participant ? getJuryResultFullUrl(participant) : undefined
  const displayName = participant ? getJuryParticipantDisplayName(participant) : ''

  return (
    <Dialog open={participant !== null} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="flex max-h-[100dvh] items-center justify-center gap-0 border-0 bg-zinc-950 p-2 shadow-none sm:p-3 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/10 [&_[data-slot=dialog-close]]:hover:text-white"
      >
        <DialogTitle className="sr-only">
          {participant ? `#${participant.reference} — ${displayName}` : 'Entry photo'}
        </DialogTitle>
        {imageUrl ? (
          <SubmissionOptimizedOriginalImage
            src={imageUrl}
            alt={`Entry by ${displayName}`}
            className="max-h-[calc(100dvh-1rem)] max-w-full object-contain"
            priority
          />
        ) : (
          <p className="text-sm text-zinc-400">No full-size photo available</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
