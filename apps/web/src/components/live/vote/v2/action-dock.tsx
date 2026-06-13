'use client'

import { useTranslations } from 'next-intl'
import { StarRatingV2 } from './star-rating-v2'
import { VoteButtonV2 } from './vote-button-v2'

interface ActionDockProps {
  currentRating: number | undefined
  onRatingChange: (rating: number) => void
  isOwnSubmission: boolean
  isSelected: boolean
  hasVoted: boolean
  hasImages: boolean
  onVote: () => void
  submissionTitle?: string
  submissionThumbnailUrl?: string
  submissionOriginalUrl?: string
}

export function ActionDock({
  currentRating,
  onRatingChange,
  isOwnSubmission,
  isSelected,
  hasVoted,
  hasImages,
  onVote,
  submissionTitle,
  submissionThumbnailUrl,
  submissionOriginalUrl,
}: ActionDockProps) {
  const t = useTranslations('VotingViewerPage')

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        {isOwnSubmission ? (
          <div className="pointer-events-auto rounded-full bg-black/35 px-4 py-2.5 text-sm font-medium text-white/80 backdrop-blur-md">
            {t('ownSubmissionBadge.label')}
          </div>
        ) : (
          <div className="pointer-events-auto rounded-full bg-black/35 px-3 backdrop-blur-md">
            <StarRatingV2 value={currentRating} onChange={onRatingChange} />
          </div>
        )}

        <VoteButtonV2
          isSelected={isSelected}
          hasVoted={hasVoted}
          isOwnSubmission={isOwnSubmission}
          isEnabled={hasImages}
          onVote={onVote}
          submissionTitle={submissionTitle}
          thumbnailUrl={submissionThumbnailUrl}
          originalUrl={submissionOriginalUrl}
          className="pointer-events-auto"
        />
      </div>
    </div>
  )
}
