'use client'

import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import { Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getThumbnailDisplaySource,
  SubmissionRawOriginalImage,
  SubmissionThumbnailImage,
} from '@/components/submission-image'
import type { VotingSubmission } from '@/lib/vote/voting-submission'

interface GridOverlayProps {
  submissions: VotingSubmission[]
  currentImageIndex: number
  selectedSubmissionId: number | null
  getRating: (submissionId: number) => number | undefined
  ratingCounts: Record<number, number>
  totalReviewCount: number
  currentFilter: number | null
  onFilterChange: (filter: number | null) => void
  onSelectIndex: (index: number) => void
  onClose: () => void
}

const filterOptions: { value: number | null; label?: string }[] = [
  { value: null },
  { value: 5, label: '5' },
  { value: 4, label: '4' },
  { value: 3, label: '3' },
  { value: 2, label: '2' },
  { value: 1, label: '1' },
]

export function GridOverlay({
  submissions,
  currentImageIndex,
  selectedSubmissionId,
  getRating,
  ratingCounts,
  totalReviewCount,
  currentFilter,
  onFilterChange,
  onSelectIndex,
  onClose,
}: GridOverlayProps) {
  const t = useTranslations('VotingViewerPage')

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute inset-0 z-30 flex flex-col bg-zinc-950/95 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
        <h2 className="text-base font-semibold text-white">{t('footer.showGrid')}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
          aria-label={t('gridView.showCarousel')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
        {filterOptions.map((option) => {
          const count = option.value === null ? totalReviewCount : ratingCounts[option.value] || 0
          const isActive = currentFilter === option.value
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={cn(
                'flex shrink-0 items-center gap-0.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors',
                isActive ? 'bg-white text-zinc-950' : 'bg-white/10 text-white/70 hover:bg-white/20',
              )}
            >
              {option.value !== null && <Star className="h-3 w-3 fill-current" />}
              {option.value === null ? t('filterBar.all') : option.label}
              {count > 0 && <span className="ml-0.5 opacity-60">({count})</span>}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        {submissions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-white/60">
              {currentFilter !== null
                ? t('emptyState.filteredDescription', { rating: currentFilter })
                : t('emptyState.defaultDescription')}
            </p>
            {currentFilter !== null && (
              <button
                type="button"
                onClick={() => onFilterChange(null)}
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                {t('emptyState.showAll')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
            {submissions.map((submission, index) => {
              const rating = getRating(submission.submissionId)
              const isSelected = submission.submissionId === selectedSubmissionId
              const isActive = index === currentImageIndex
              const imageSource = getThumbnailDisplaySource({
                thumbnailUrl: submission.thumbnailUrl,
                originalUrl: submission.url,
              })
              const imageAlt = t('gridView.photoAlt', {
                participantId: submission.participantId,
              })
              return (
                <button
                  key={submission.submissionId}
                  type="button"
                  onClick={() => onSelectIndex(index)}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-lg bg-white/5',
                    isActive && 'ring-2 ring-white',
                    isSelected && 'ring-2 ring-red-400',
                  )}
                >
                  {imageSource.kind === 'optimized-thumbnail' ? (
                    <SubmissionThumbnailImage
                      src={imageSource.src}
                      alt={imageAlt}
                      className="h-full w-full object-cover"
                    />
                  ) : imageSource.kind === 'raw-original-fallback' ? (
                    <SubmissionRawOriginalImage
                      src={imageSource.src}
                      alt={imageAlt}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-xs text-white/40">{t('gridView.noImage')}</span>
                    </div>
                  )}
                  {submission.isOwnSubmission && (
                    <div className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      {t('ownSubmissionBadge.label')}
                    </div>
                  )}
                  {rating !== undefined && (
                    <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 backdrop-blur-sm">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      {rating}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
